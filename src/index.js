const fs = require('fs');
const path = require('path');

class Governor {
    constructor(options = {}) {
        const workspaceState = path.join(process.cwd(), '..', 'state.json');
        const localState = path.join(process.cwd(), 'state.json');
        
        this.stateFile = options.stateFile || (fs.existsSync(workspaceState) ? workspaceState : localState);
        
        this.PRIORITY_MAP = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        
        this.COSTS = {
            'chat': 1,
            'agent_turn': 5,
            'heartbeat': 1,
            'cron_job': 3
        };

        const CloudCostMonitor = require('./finance/cloud_cost_monitor');
        this.costMonitor = new CloudCostMonitor(this);

        // Tier 1 Google Gemini Flash 3 Specifications
        this.TPM_LIMIT = 1000000;
        this.TPM_THRESHOLD = 0.40; // AGGRESSIVE: Pause at 40% (400k) to account for large next turn
        this.WINDOW_SIZE_MS = 60000; // 1 minute
        
        this.TPM_PAUSE_MS = 60000; // 1 minute pause

        this.CIRCUIT_BREAKER_THRESHOLD = 5;
        this.CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000;

        this.SCHEDULE = [
            { hour: 0, weight: 0.1, mode: 'filler' },
            { hour: 1, weight: 0.1, mode: 'filler' },
            { hour: 2, weight: 0.1, mode: 'filler' },
            { hour: 3, weight: 0.1, mode: 'filler' },
            { hour: 4, weight: 0.2, mode: 'filler' },
            { hour: 5, weight: 0.4, mode: 'active' },
            { hour: 6, weight: 0.8, mode: 'active' },
            { hour: 7, weight: 1.0, mode: 'peak' },
            { hour: 8, weight: 1.2, mode: 'peak' },
            { hour: 9, weight: 1.5, mode: 'peak' },
            { hour: 10, weight: 1.2, mode: 'peak' },
            { hour: 11, weight: 1.0, mode: 'peak' },
            { hour: 12, weight: 0.8, mode: 'active' },
            { hour: 13, weight: 1.0, mode: 'peak' },
            { hour: 14, weight: 1.2, mode: 'peak' },
            { hour: 15, weight: 1.2, mode: 'peak' },
            { hour: 16, weight: 1.0, mode: 'peak' },
            { hour: 17, weight: 0.8, mode: 'active' },
            { hour: 18, weight: 0.6, mode: 'active' },
            { hour: 19, weight: 0.5, mode: 'active' },
            { hour: 20, weight: 0.4, mode: 'filler' },
            { hour: 21, weight: 0.3, mode: 'filler' },
            { hour: 22, weight: 0.2, mode: 'filler' },
            { hour: 23, weight: 0.1, mode: 'filler' }
        ];

        const Analytics = require('./analytics');
        this.analytics = new Analytics(this);
    }

    loadState() {
        if (!fs.existsSync(this.stateFile)) return null;
        try {
            const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
            if (!state.config.currentUsage.requestLog) state.config.currentUsage.requestLog = [];
            if (!state.config.currentUsage.tokenLog) state.config.currentUsage.tokenLog = [];
            return state;
        } catch (e) {
            console.error("Error reading state file:", e);
            return null;
        }
    }

    saveState(state) {
        const tempFile = `${this.stateFile}.tmp`;
        try {
            fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
            fs.renameSync(tempFile, this.stateFile);
        } catch (e) {
            console.error("Critical: Failed to save state atomically.", e);
        }
    }

    _cleanLogs(state) {
        const now = Date.now();
        state.config.currentUsage.requestLog = state.config.currentUsage.requestLog.filter(ts => (now - ts) < this.WINDOW_SIZE_MS);
        state.config.currentUsage.thisMinute = state.config.currentUsage.requestLog.length;
        state.config.currentUsage.tokenLog = state.config.currentUsage.tokenLog.filter(entry => (now - entry.ts) < this.WINDOW_SIZE_MS);
        state.config.currentUsage.tpmUsed = state.config.currentUsage.tokenLog.reduce((sum, entry) => sum + entry.amount, 0);
    }

    _checkReset(state) {
        const now = new Date();
        const lastReset = new Date(state.config.currentUsage.lastReset);
        let dirty = false;

        if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            state.config.currentUsage.today = 0;
            state.config.currentUsage.thisHour = 0;
            state.config.currentUsage.lastReset = now.toISOString();
            dirty = true;
        } 
        else if (now.getHours() !== lastReset.getHours()) {
            state.config.currentUsage.thisHour = 0;
            state.config.currentUsage.lastReset = now.toISOString();
            dirty = true;
        }
        
        this._cleanLogs(state);
        return dirty;
    }

    getDynamicStatus(state) {
        if (!state) state = this.loadState();
        if (!state) return { status: 'RED', autonomyBudget: 0, error: "State not loaded" };

        this._checkReset(state);

        const { today, thisHour, thisMinute, tpmUsed } = state.config.currentUsage;
        const { dailyLimit, hourlyLimit, rpmLimit } = state.config;

        const now = new Date();
        const hourConfig = this.SCHEDULE.find(s => s.hour === now.getHours()) || { weight: 1.0, mode: 'active' };
        
        const predictedUser = 20; 
        const weightedHourlyLimit = hourlyLimit * hourConfig.weight;
        const autonomyBudget = Math.max(0, weightedHourlyLimit - thisHour - predictedUser);

        // Hard Caps
        if (today >= dailyLimit) return { status: 'RED', reason: 'daily_limit', autonomyBudget: 0 };
        if (thisHour >= weightedHourlyLimit) return { status: 'RED', reason: 'scheduled_throttle', autonomyBudget: 0 };
        
        // TPM Protection (Proactive / Predictive)
        if (tpmUsed >= (this.TPM_LIMIT * this.TPM_THRESHOLD)) {
            const firstEntry = state.config.currentUsage.tokenLog[0] || { ts: Date.now() };
            const waitSeconds = Math.ceil((this.WINDOW_SIZE_MS - (Date.now() - firstEntry.ts)) / 1000);
            return { 
                status: 'RED', 
                reason: 'tpm_safeguard', 
                autonomyBudget: 0, 
                waitSeconds: Math.max(waitSeconds, 10), 
                mode: hourConfig.mode 
            };
        }

        // RPM Protection
        if (thisMinute >= (rpmLimit || 25)) {
            return { status: 'RED', reason: 'rpm_burst_limit', autonomyBudget: 0, waitSeconds: 15 };
        }

        if (autonomyBudget <= 0) return { status: 'RED', reason: 'throttled_or_reserve', autonomyBudget };
        
        return { status: 'GREEN', reason: 'good', autonomyBudget, mode: hourConfig.mode };
    }

    incrementUsage(amount = 1, tokens = 0) {
        const state = this.loadState();
        if (!state) return;
        this._checkReset(state);
        state.config.currentUsage.today += amount;
        state.config.currentUsage.thisHour += amount;
        const now = Date.now();
        for (let i = 0; i < amount; i++) state.config.currentUsage.requestLog.push(now);
        if (tokens > 0) state.config.currentUsage.tokenLog.push({ ts: now, amount: tokens });
        this.saveState(state);
        this.analytics.trackMetric('apiCalls', amount);
        if (tokens > 0) this.analytics.trackMetric('tokens', tokens);
    }
    // ... remaining task methods ...
}
module.exports = Governor;
