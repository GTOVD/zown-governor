const fs = require('fs');
const path = require('path');

class Governor {
    constructor(options = {}) {
        this.stateFile = options.stateFile || path.join(process.cwd(), 'state.json');
        
        // Priority Weights
        this.PRIORITY_MAP = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        
        // Usage Estimates (Requests per action) - could be config, keeping hardcoded for now
        this.COSTS = {
            'chat': 1,
            'agent_turn': 5,
            'heartbeat': 1,
            'cron_job': 3
        };

        // Cloud Cost Monitoring (SELF-008)
        const CloudCostMonitor = require('./finance/cloud_cost_monitor');
        this.costMonitor = new CloudCostMonitor(this);

        // TPM Limits (1M TPM default for Gemini)
        this.TPM_LIMIT = 1000000;
        this.TPM_THRESHOLD = 0.9; // Pause at 90%
        this.WINDOW_SIZE_MS = 60000; // 1 minute

        // Circuit Breaker (GOV-024)
        this.CIRCUIT_BREAKER_THRESHOLD = 5; // 5 errors
        this.CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

        // Advanced Budget Scheduling (GOV-022)
        this.SCHEDULE = [
            { hour: 0, weight: 0.1, mode: 'filler' },  // Midnight
            { hour: 1, weight: 0.1, mode: 'filler' },
            { hour: 2, weight: 0.1, mode: 'filler' },
            { hour: 3, weight: 0.1, mode: 'filler' },
            { hour: 4, weight: 0.2, mode: 'filler' },
            { hour: 5, weight: 0.4, mode: 'active' },
            { hour: 6, weight: 0.8, mode: 'active' },  // Morning Ramp
            { hour: 7, weight: 1.0, mode: 'peak' },
            { hour: 8, weight: 1.2, mode: 'peak' },
            { hour: 9, weight: 1.5, mode: 'peak' },    // Peak Creative
            { hour: 10, weight: 1.2, mode: 'peak' },
            { hour: 11, weight: 1.0, mode: 'peak' },
            { hour: 12, weight: 0.8, mode: 'active' }, // Noon dip
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

        // Analytics Layer
        const Analytics = require('./analytics');
        this.analytics = new Analytics(this);
    }

    loadState() {
        if (!fs.existsSync(this.stateFile)) return null;
        try {
            const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
            // Ensure rolling window array exists
            if (!state.config.currentUsage.requestLog) {
                state.config.currentUsage.requestLog = [];
            }
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
            // Fallback to direct write if rename fails? No, better to keep current file safe.
            // But we might want to know why it failed.
        }
    }

    isWeekend() {
        const day = new Date().getDay();
        return day === 0 || day === 6; // 0=Sun, 6=Sat
    }

    getPredictedUserUsage(config) {
        // Base usage assumption (requests per hour)
        let baseUsage = 10; 

        // 1. Day of Week Factor
        const dayFactor = this.isWeekend() ? 
            (config.userProfile?.weekendFactor || 2.0) : 
            (config.userProfile?.weekdayFactor || 0.5);
        
        // 2. Monthly Trend Factor
        let monthFactor = 1.0;
        if (config.userProfile?.monthlyTrend === 'low_dev') monthFactor = 0.5;
        if (config.userProfile?.monthlyTrend === 'high_dev') monthFactor = 1.5;

        return baseUsage * dayFactor * monthFactor;
    }

    // Clean up rolling window
    _cleanRollingWindow(state) {
        const now = Date.now();
        const initialCount = state.config.currentUsage.requestLog.length;
        
        state.config.currentUsage.requestLog = state.config.currentUsage.requestLog.filter(ts => (now - ts) < this.WINDOW_SIZE_MS);
        
        // Update thisMinute for backward compatibility / status display
        state.config.currentUsage.thisMinute = state.config.currentUsage.requestLog.length;
        
        return state.config.currentUsage.requestLog.length !== initialCount;
    }

    // Helper to handle time-boundary resets (day/hour/minute)
    _checkReset(state) {
        const now = new Date();
        const lastReset = new Date(state.config.currentUsage.lastReset);
        let dirty = false;

        // Daily Reset
        if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            state.config.currentUsage.today = 0;
            state.config.currentUsage.thisHour = 0;
            state.config.currentUsage.thisMinute = 0;
            state.config.currentUsage.tpmUsed = 0;
            state.config.currentUsage.requestLog = [];
            state.config.currentUsage.lastReset = now.toISOString();
            dirty = true;
        } 
        // Hourly Reset
        else if (now.getHours() !== lastReset.getHours()) {
            state.config.currentUsage.thisHour = 0;
            state.config.currentUsage.tpmUsed = 0;
            state.config.currentUsage.lastReset = now.toISOString();
            dirty = true;
        }
        
        // Always clean rolling window for minute-level accuracy
        const windowCleaned = this._cleanRollingWindow(state);
        
        return dirty || windowCleaned;
    }

    getDynamicStatus(state) {
        if (!state) state = this.loadState();
        if (!state) return { status: 'RED', autonomyBudget: 0, error: "State not loaded" };

        const dirty = this._checkReset(state);
        if (dirty) this.saveState(state);

        // --- Circuit Breaker Check ---
        if (state.config.currentUsage.errorCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
            const lastErrorAt = new Date(state.config.currentUsage.lastErrorAt).getTime();
            if ((Date.now() - lastErrorAt) < this.CIRCUIT_BREAKER_COOLDOWN_MS) {
                return { 
                    status: 'RED', 
                    reason: 'circuit_breaker_open', 
                    errorCount: state.config.currentUsage.errorCount,
                    retryAt: new Date(lastErrorAt + this.CIRCUIT_BREAKER_COOLDOWN_MS).toISOString(),
                    autonomyBudget: 0 
                };
            } else {
                // Cooldown passed, reset half-open
                state.config.currentUsage.errorCount = 0;
                this.saveState(state);
            }
        }

        const { today, thisHour, thisMinute, tpmUsed } = state.config.currentUsage;
        const { dailyLimit, hourlyLimit, rpmLimit } = state.config;

        // --- GOV-022: Advanced Budget Scheduling ---
        const now = new Date();
        const hourConfig = this.SCHEDULE.find(s => s.hour === now.getHours()) || { weight: 1.0, mode: 'active' };
        
        // Base Dynamic Budgeting
        const predictedUser = this.getPredictedUserUsage(state.config);
        
        // Calculate remaining day intensity
        const hoursLeft = 24 - now.getHours();
        const dailyRemaining = dailyLimit - today;
        const burnRate = dailyRemaining / Math.max(1, hoursLeft);
        
        // Apply Weight to hourly limit
        const weightedHourlyLimit = Math.min(hourlyLimit, burnRate * hourConfig.weight * 2);
        const autonomyBudget = Math.max(0, weightedHourlyLimit - thisHour - predictedUser);

        // Hard Caps (API Limits)
        if (today >= dailyLimit) return { status: 'RED', reason: 'daily_limit', autonomyBudget: 0, mode: hourConfig.mode };
        if (thisHour >= weightedHourlyLimit) return { status: 'RED', reason: 'scheduled_throttle', autonomyBudget: 0, mode: hourConfig.mode };
        
        // TPM Protection
        if (tpmUsed >= (this.TPM_LIMIT * this.TPM_THRESHOLD)) {
            return { status: 'RED', reason: 'tpm_safeguard', autonomyBudget: 0, waitSeconds: 60, mode: hourConfig.mode };
        }

        // Burst Protection (RPM)
        if (thisMinute >= (rpmLimit || 25)) {
            return { status: 'RED', reason: 'rpm_burst_limit', autonomyBudget: 0, waitSeconds: 60, mode: hourConfig.mode };
        }

        // Status Determination
        if (autonomyBudget <= 0) {
            return { status: 'RED', reason: 'throttled_or_reserve', autonomyBudget, mode: hourConfig.mode };
        } else if (autonomyBudget < 5) {
            return { status: 'YELLOW', reason: 'low_budget', autonomyBudget, mode: hourConfig.mode };
        } else {
            return { status: 'GREEN', reason: 'good', autonomyBudget, mode: hourConfig.mode };
        }
    }

    incrementUsage(amount = 1, tokens = 0) {
        const state = this.loadState();
        if (!state) return;

        // Ensure we reset boundaries before incrementing
        this._checkReset(state);

        state.config.currentUsage.today += amount;
        state.config.currentUsage.thisHour += amount;
        
        // Rolling window log
        const now = Date.now();
        for (let i = 0; i < amount; i++) {
            state.config.currentUsage.requestLog.push(now);
        }
        state.config.currentUsage.thisMinute = state.config.currentUsage.requestLog.length;
        
        if (!state.config.currentUsage.tpmUsed) state.config.currentUsage.tpmUsed = 0;
        state.config.currentUsage.tpmUsed += tokens;

        state.config.currentUsage.lastReset = new Date().toISOString(); 
        
        this.saveState(state);

        // Track Metrics
        this.analytics.trackMetric('apiCalls', amount);
        if (tokens > 0) this.analytics.trackMetric('tokens', tokens);
    }

    getNextTask() {
        const state = this.loadState();
        if (!state) return { error: "State file missing" };

        const { status, autonomyBudget } = this.getDynamicStatus(state);

        if (status === 'RED') {
            return { error: "RATE_LIMIT_EXCEEDED", status: "RED" };
        }

        const now = Date.now();
        const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

        // Filter pending tasks, excluding those with active valid reservations
        let tasks = state.backlog.filter(t => {
            if (t.status !== 'pending') return false;
            if (t.reservedUntil && new Date(t.reservedUntil).getTime() > now) return false;
            return true;
        });

        // Filter by Priority based on Status/Budget
        if (status === 'YELLOW' || autonomyBudget < 10) {
            // Conservative: Only Critical/High
            tasks = tasks.filter(t => this.PRIORITY_MAP[t.priority] >= 3);
        }

        // Sort by Priority then ID
        tasks.sort((a, b) => {
            const pDiff = (this.PRIORITY_MAP[b.priority] || 1) - (this.PRIORITY_MAP[a.priority] || 1);
            if (pDiff !== 0) return pDiff;
            return a.id.localeCompare(b.id);
        });

        // Pick top task
        if (tasks.length > 0) {
            const task = tasks[0];
            task.status = 'in_progress';
            task.startedAt = new Date().toISOString();
            task.reservedUntil = new Date(now + LOCK_TTL_MS).toISOString();
            this.saveState(state);
            this.incrementUsage(1); 
            return { ...task, systemStatus: status, budget: autonomyBudget };
        }

        // FILLER LOGIC
        if (status === 'GREEN' && autonomyBudget > 5) {
            // Auto-Generate "Hourly Pulse"
            const lastPulseTime = new Date(state.config.lastPulseAt || 0);
            const hoursSincePulse = (new Date() - lastPulseTime) / (1000 * 60 * 60);
            
            if (hoursSincePulse > 1) {
                 this.incrementUsage(1);
                 state.config.lastPulseAt = new Date().toISOString();
                 this.saveState(state);
                 return {
                    id: `auto-pulse-${Date.now()}`,
                    title: "Hourly Devlog Pulse",
                    priority: "medium",
                    type: "pulse",
                    description: "Write a short, stream-of-consciousness update to devlog/posts/ about current thoughts, progress, or system status.",
                    systemStatus: "GREEN",
                    budget: autonomyBudget
                };
            }

            this.incrementUsage(1);
            return {
                id: `auto-${Date.now()}`,
                title: "System Maintenance / Reflection",
                priority: "low",
                type: "filler",
                description: "Perform a quick health check or memory organization.",
                systemStatus: "GREEN",
                budget: autonomyBudget
            };
        }

        return { message: "No tasks", status, budget: autonomyBudget };
    }

    getTasks(statusFilter = null) {
        const state = this.loadState();
        if (!state) return [];
        
        if (statusFilter) {
            return state.backlog.filter(t => t.status === statusFilter);
        }
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
            
            // Circuit Breaker Increment
            state.config.currentUsage.errorCount = (state.config.currentUsage.errorCount || 0) + 1;
            state.config.currentUsage.lastErrorAt = new Date().toISOString();

            this.saveState(state);

            // Track Metrics
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

            // Success resets error count (Circuit Breaker half-open logic)
            state.config.currentUsage.errorCount = 0;

            this.saveState(state);

            // Track Metrics
            this.analytics.trackMetric('tasksCompleted');

            return true;
        }
        return false;
    }

    addTask(title, priority = 'medium', description = '') {
        const state = this.loadState();
        if (!state) return { error: "State file missing" };

        if (!Object.keys(this.PRIORITY_MAP).includes(priority)) {
            return { error: `Invalid priority: ${priority}. Must be one of: ${Object.keys(this.PRIORITY_MAP).join(', ')}` };
        }

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
            if (updates.priority && !Object.keys(this.PRIORITY_MAP).includes(updates.priority)) {
                return false; 
            }

            // Only allow updating certain fields
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

    selfHeal() {
        const state = this.loadState();
        if (!state) return { healed: 0, error: "State file missing" };

        const now = Date.now();
        const ORPHAN_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
        let healedCount = 0;

        state.backlog.forEach(task => {
            if (task.status === 'in_progress') {
                const startedAt = task.startedAt ? new Date(task.startedAt).getTime() : 0;
                const reservedUntil = task.reservedUntil ? new Date(task.reservedUntil).getTime() : 0;
                
                // If the task has exceeded both its explicit reservation and the 1-hour grace period
                if ((now - startedAt) > ORPHAN_THRESHOLD_MS && now > reservedUntil) {
                    task.status = 'pending';
                    task.healedAt = new Date().toISOString();
                    task.healedFrom = 'in_progress';
                    healedCount++;
                }
            }
        });

        if (healedCount > 0) {
            this.saveState(state);
        }

        return { healed: healedCount };
    }

    init(options = {}) {
        if (fs.existsSync(this.stateFile)) {
            return { message: "State file already exists", path: this.stateFile };
        }
        
        const defaultState = {
            config: {
                dailyLimit: 250,
                hourlyLimit: 20,
                rpmLimit: 25,
                currentUsage: {
                    today: 0,
                    thisHour: 0,
                    thisMinute: 0,
                    lastReset: new Date().toISOString()
                },
                userProfile: {
                    weekendFactor: 2.0,
                    weekdayFactor: 0.5,
                    monthlyTrend: "neutral"
                }
            },
            backlog: []
        };
        this.saveState(defaultState);
        return { message: "Initialized new state file", path: this.stateFile };
    }
}

module.exports = Governor;
