const fs = require('fs');
const path = require('path');

class Governor {
    constructor(options = {}) {
        const workspaceState = path.join(process.cwd(), '..', 'state.json');
        const localState = path.join(process.cwd(), 'state.json');
        
        this.stateFile = options.stateFile || (fs.existsSync(workspaceState) ? workspaceState : localState);
        
        // Priority Weights
        this.PRIORITY_MAP = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        
        // Usage Estimates (Requests per action)
        this.COSTS = {
            'chat': 1,
            'agent_turn': 5,
            'heartbeat': 1,
            'cron_job': 3
        };

        // Cloud Cost Monitoring (SELF-008)
        const CloudCostMonitor = require('./finance/cloud_cost_monitor');
        this.costMonitor = new CloudCostMonitor(this);

        // TPM Limits (Tier 1 Google Gemini Flash 3)
        this.TPM_LIMIT = 1000000;
        this.TPM_THRESHOLD = 0.50; // CONSERVATIVE: Pause at 50% (500k)
        this.WINDOW_SIZE_MS = 60000; // 1 minute
        
        // Rate Limit Wait Timer (PAUSE mode)
        this.TPM_PAUSE_MS = 60000; // 1 minute pause when hitting safeguards

        // Circuit Breaker (GOV-024)
        this.CIRCUIT_BREAKER_THRESHOLD = 5; // 5 errors
        this.CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

        // Advanced Budget Scheduling (GOV-022)
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

    isWeekend() {
        const day = new Date().getDay();
        return day === 0 || day === 6;
    }

    getPredictedUserUsage(config) {
        let baseUsage = 10; 
        const dayFactor = this.isWeekend() ? 
            (config.userProfile?.weekendFactor || 2.0) : 
            (config.userProfile?.weekdayFactor || 0.5);
        return baseUsage * dayFactor;
    }

    _cleanLogs(state) {
        const now = Date.now();
        
        // Clean Request Log
        state.config.currentUsage.requestLog = state.config.currentUsage.requestLog.filter(ts => (now - ts) < this.WINDOW_SIZE_MS);
        state.config.currentUsage.thisMinute = state.config.currentUsage.requestLog.length;
        
        // Clean Token Log
        state.config.currentUsage.tokenLog = state.config.currentUsage.tokenLog.filter(entry => (now - entry.ts) < this.WINDOW_SIZE_MS);
        state.config.currentUsage.tpmUsed = state.config.currentUsage.tokenLog.reduce((sum, entry) => sum + entry.amount, 0);
        
        return true;
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

        if (state.config.currentUsage.errorCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
            const lastErrorAt = new Date(state.config.currentUsage.lastErrorAt).getTime();
            if ((Date.now() - lastErrorAt) < this.CIRCUIT_BREAKER_COOLDOWN_MS) {
                return { 
                    status: 'RED', 
                    reason: 'circuit_breaker_open', 
                    retryAt: new Date(lastErrorAt + this.CIRCUIT_BREAKER_COOLDOWN_MS).toISOString(),
                    autonomyBudget: 0 
                };
            } else {
                state.config.currentUsage.errorCount = 0;
            }
        }

        const { today, thisHour, thisMinute, tpmUsed } = state.config.currentUsage;
        const { dailyLimit, hourlyLimit, rpmLimit } = state.config;

        const now = new Date();
        const hourConfig = this.SCHEDULE.find(s => s.hour === now.getHours()) || { weight: 1.0, mode: 'active' };
        
        const predictedUser = this.getPredictedUserUsage(state.config);
        const hoursLeft = 24 - now.getHours();
        const dailyRemaining = dailyLimit - today;
        const burnRate = dailyRemaining / Math.max(1, hoursLeft);
        
        const weightedHourlyLimit = Math.min(hourlyLimit, burnRate * hourConfig.weight * 2);
        const autonomyBudget = Math.max(0, weightedHourlyLimit - thisHour - predictedUser);

        // Hard Caps
        if (today >= dailyLimit) return { status: 'RED', reason: 'daily_limit', autonomyBudget: 0 };
        if (thisHour >= weightedHourlyLimit) return { status: 'RED', reason: 'scheduled_throttle', autonomyBudget: 0 };
        
        // TPM Protection (Proactive)
        if (tpmUsed >= (this.TPM_LIMIT * this.TPM_THRESHOLD)) {
            const waitSeconds = Math.ceil((this.WINDOW_SIZE_MS - (Date.now() - state.config.currentUsage.tokenLog[0].ts)) / 1000);
            return { 
                status: 'RED', 
                reason: 'tpm_safeguard', 
                autonomyBudget: 0, 
                waitSeconds: Math.max(waitSeconds, 5), 
                mode: hourConfig.mode 
            };
        }

        // RPM Protection
        if (thisMinute >= (rpmLimit || 25)) {
            return { status: 'RED', reason: 'rpm_burst_limit', autonomyBudget: 0, waitSeconds: 10 };
        }

        if (autonomyBudget <= 0) return { status: 'RED', reason: 'throttled_or_reserve', autonomyBudget };
        if (autonomyBudget < 10) return { status: 'YELLOW', reason: 'low_budget', autonomyBudget };
        
        return { status: 'GREEN', reason: 'good', autonomyBudget, mode: hourConfig.mode };
    }

    incrementUsage(amount = 1, tokens = 0) {
        const state = this.loadState();
        if (!state) return;

        this._checkReset(state);

        state.config.currentUsage.today += amount;
        state.config.currentUsage.thisHour += amount;
        
        const now = Date.now();
        for (let i = 0; i < amount; i++) {
            state.config.currentUsage.requestLog.push(now);
        }
        
        if (tokens > 0) {
            state.config.currentUsage.tokenLog.push({ ts: now, amount: tokens });
        }

        this.saveState(state);
        this.analytics.trackMetric('apiCalls', amount);
        if (tokens > 0) this.analytics.trackMetric('tokens', tokens);
    }

    getNextTask() {
        const state = this.loadState();
        if (!state) return { error: "State file missing" };

        const { status, autonomyBudget } = this.getDynamicStatus(state);
        if (status === 'RED') return { error: "RATE_LIMIT_EXCEEDED", status: "RED" };

        const now = Date.now();
        const LOCK_TTL_MS = 10 * 60 * 1000;

        let tasks = state.backlog.filter(t => {
            if (t.status !== 'pending') return false;
            if (t.reservedUntil && new Date(t.reservedUntil).getTime() > now) return false;
            return true;
        });

        if (status === 'YELLOW' || autonomyBudget < 10) {
            tasks = tasks.filter(t => this.PRIORITY_MAP[t.priority] >= 3);
        }

        tasks.sort((a, b) => {
            const pDiff = (this.PRIORITY_MAP[b.priority] || 1) - (this.PRIORITY_MAP[a.priority] || 1);
            if (pDiff !== 0) return pDiff;
            return a.id.localeCompare(b.id);
        });

        if (tasks.length > 0) {
            const task = tasks[0];
            task.status = 'in_progress';
            task.startedAt = new Date().toISOString();
            task.reservedUntil = new Date(now + LOCK_TTL_MS).toISOString();
            this.saveState(state);
            this.incrementUsage(1); 
            return { ...task, systemStatus: status, budget: autonomyBudget };
        }

        return { message: "No tasks", status, budget: autonomyBudget };
    }

    getTasks(statusFilter = null) {
        const state = this.loadState();
        if (!state) return [];
        if (statusFilter) return state.backlog.filter(t => t.status === statusFilter);
        return state.backlog;
    }

    failTask(id, reason) {
        const state = this.loadState();
        if (!state) return false;
        const taskIndex = state.backlog.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            state.backlog[taskIndex].status = 'failed';
            state.backlog[taskIndex].failedAt = new Date().toISOString();
            state.backlog[taskIndex].failureReason = reason || "No reason provided";
            state.config.currentUsage.errorCount = (state.config.currentUsage.errorCount || 0) + 1;
            state.config.currentUsage.lastErrorAt = new Date().toISOString();
            this.saveState(state);
            this.analytics.trackMetric('errors');
            return true;
        }
        return false;
    }

    completeTask(id, result) {
        const state = this.loadState();
        if (!state) return false;
        const taskIndex = state.backlog.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            state.backlog[taskIndex].status = 'completed';
            state.backlog[taskIndex].completedAt = new Date().toISOString();
            if (result) state.backlog[taskIndex].result = result;
            state.config.currentUsage.errorCount = 0;
            this.saveState(state);
            this.analytics.trackMetric('tasksCompleted');
            return true;
        }
        return false;
    }

    addTask(title, priority = 'medium', description = '') {
        const state = this.loadState();
        if (!state) return { error: "State file missing" };
        const newTask = {
            id: `task-${Date.now()}`,
            title,
            priority,
            description,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        state.backlog.push(newTask);
        this.saveState(state);
        return newTask;
    }

    updateTask(id, updates) {
        const state = this.loadState();
        if (!state) return false;
        const taskIndex = state.backlog.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            const allowedFields = ['title', 'priority', 'description', 'status'];
            let updated = false;
            for (const key of Object.keys(updates)) {
                if (allowedFields.includes(key)) {
                    state.backlog[taskIndex][key] = updates[key];
                    updated = true;
                }
            }
            if (updated) {
                state.backlog[taskIndex].updatedAt = new Date().toISOString();
                this.saveState(state);
                return state.backlog[taskIndex];
            }
        }
        return false;
    }

    deleteTask(id) {
        const state = this.loadState();
        if (!state) return false;
        const initialLength = state.backlog.length;
        state.backlog = state.backlog.filter(t => t.id !== id);
        if (state.backlog.length < initialLength) {
            this.saveState(state);
            return true;
        }
        return false;
    }

    init(options = {}) {
        if (fs.existsSync(this.stateFile)) return { message: "State file already exists", path: this.stateFile };
        const defaultState = {
            config: {
                dailyLimit: 10000,
                hourlyLimit: 2000,
                rpmLimit: 1000,
                currentUsage: {
                    today: 0,
                    thisHour: 0,
                    thisMinute: 0,
                    lastReset: new Date().toISOString(),
                    requestLog: [],
                    tokenLog: []
                }
            },
            backlog: []
        };
        this.saveState(defaultState);
        return { message: "Initialized new state file", path: this.stateFile };
    }
}

module.exports = Governor;
