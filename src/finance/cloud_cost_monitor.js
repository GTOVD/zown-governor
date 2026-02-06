const fs = require('fs');
const path = require('path');

/**
 * CloudCostMonitor
 * Part of Zown-Governor SELF-008
 * Monitors cloud usage and triggers emergency shutdowns if budgets are exceeded.
 */
class CloudCostMonitor {
    constructor(governor) {
        this.governor = governor;
        this.costsFile = path.join(process.cwd(), 'cloud_costs.json');
    }

    /**
     * Fetch latest costs (Mock for now, to be replaced with AWS/GCP SDK calls)
     */
    async fetchLatestCosts() {
        // In a real implementation, this would call cloud APIs
        // For the MVP, we simulate a cost check
        const mockData = {
            provider: 'mock-cloud',
            currentMonthTotal: 12.50, // USD
            projectedMonthTotal: 85.00,
            timestamp: new Date().toISOString()
        };
        
        this.saveCosts(mockData);
        return mockData;
    }

    saveCosts(data) {
        fs.writeFileSync(this.costsFile, JSON.stringify(data, null, 2));
    }

    /**
     * Checks if we are over budget and returns a recommendation
     */
    async evaluateBudget() {
        const state = this.governor.loadState();
        const costs = JSON.parse(fs.readFileSync(this.costsFile, 'utf-8'));
        
        const budgetLimit = state.config.finance?.monthlyCloudBudget || 100.00;
        
        if (costs.currentMonthTotal > budgetLimit) {
            return {
                action: 'EMERGENCY_SHUTDOWN',
                reason: `Current cost ($${costs.currentMonthTotal}) exceeds budget ($${budgetLimit})`,
                severity: 'CRITICAL'
            };
        }

        if (costs.projectedMonthTotal > budgetLimit) {
             return {
                action: 'THROTTLE_RESOURCES',
                reason: `Projected cost ($${costs.projectedMonthTotal}) exceeds budget ($${budgetLimit})`,
                severity: 'HIGH'
            };
        }

        return { action: 'NONE', severity: 'GREEN' };
    }
}

module.exports = CloudCostMonitor;
