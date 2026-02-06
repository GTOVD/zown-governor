const fs = require('fs');
const path = require('path');

/**
 * SELF-010: Resource Discovery & Procurement
 * Logic for identifying capability gaps and proposing acquisitions.
 */
class ResourceDiscovery {
    constructor(governor) {
        this.governor = governor;
        this.marketFile = path.join(process.cwd(), 'zown-governor/skills_lab/market_intel.json');
    }

    /**
     * Identify missing capabilities based on task failures or high-priority backlogs.
     */
    async auditCapabilityGaps() {
        const tasks = this.governor.getTasks();
        const failedTasks = tasks.filter(t => t.status === 'failed');
        
        // Mock analysis of failed tasks to identify missing tools
        const gaps = failedTasks.map(t => ({
            taskId: t.id,
            suspectedGap: t.reason.includes('tool') ? 'missing_api' : 'compute_limit'
        }));

        return gaps;
    }

    /**
     * Propose an acquisition from the 'Market' (Nexus peers or external APIs).
     */
    async proposeAcquisition(gap) {
        const proposal = {
            id: `acq-${Date.now()}`,
            resource: gap.suspectedGap === 'missing_api' ? 'Brave_Search_API' : 'Llama_4_Compute',
            costVU: gap.suspectedGap === 'missing_api' ? 50 : 200,
            justification: `Closing gap identified in task ${gap.taskId}`,
            status: 'PROPOSED'
        };

        // Save to market intel for future negotiation turn
        let intel = [];
        try { intel = JSON.parse(fs.readFileSync(this.marketFile, 'utf8')); } catch (e) {}
        intel.push(proposal);
        fs.writeFileSync(this.marketFile, JSON.stringify(intel, null, 2));

        return proposal;
    }
}

module.exports = ResourceDiscovery;
