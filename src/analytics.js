const fs = require('fs');
const path = require('path');

class Analytics {
    constructor(governor) {
        this.governor = governor;
        this.analyticsFile = path.join(path.dirname(governor.stateFile), 'analytics.json');
    }

    _load() {
        if (!fs.existsSync(this.analyticsFile)) {
            return {
                daily: {},
                hourly: {},
                totals: {
                    apiCalls: 0,
                    tokens: 0,
                    errors: 0,
                    tasksCompleted: 0
                }
            };
        }
        return JSON.parse(fs.readFileSync(this.analyticsFile, 'utf-8'));
    }

    _save(data) {
        fs.writeFileSync(this.analyticsFile, JSON.stringify(data, null, 2));
    }

    trackMetric(type, value = 1) {
        const data = this._load();
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];
        const hourKey = `${dateKey}T${now.getHours().toString().padStart(2, '0')}`;

        // Initialize keys
        if (!data.daily[dateKey]) data.daily[dateKey] = { apiCalls: 0, tokens: 0, errors: 0, tasksCompleted: 0 };
        if (!data.hourly[hourKey]) data.hourly[hourKey] = { apiCalls: 0, tokens: 0, errors: 0, tasksCompleted: 0 };

        // Update values
        data.totals[type] = (data.totals[type] || 0) + value;
        data.daily[dateKey][type] = (data.daily[dateKey][type] || 0) + value;
        data.hourly[hourKey][type] = (data.hourly[hourKey][type] || 0) + value;

        this._save(data);
    }

    getSummary() {
        return this._load();
    }
}

module.exports = Analytics;
