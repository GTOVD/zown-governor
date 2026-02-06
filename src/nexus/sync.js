/**
 * NEXUS-008: Knowledge Graph Sync Protocol
 * Synchronizes sanitized memory nodes between Zown instances.
 */

const fs = require('fs');
const path = require('path');

class SyncProtocol {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot || process.cwd();
        this.memoryPath = path.join(this.workspaceRoot, 'MEMORY.md');
    }

    /**
     * Extracts memory nodes, filtering out PII or sensitive data.
     */
    async extractSanitizedNodes() {
        if (!fs.existsSync(this.memoryPath)) return [];

        const content = fs.readFileSync(this.memoryPath, 'utf8');
        const lines = content.split('\n');
        const nodes = [];

        let currentSection = 'General';
        
        for (const line of lines) {
            if (line.startsWith('## ')) {
                currentSection = line.replace('## ', '').trim();
                continue;
            }

            // Sanitization rules: 
            // 1. Skip sections related to User Bio or Private Bio
            // 2. Skip lines containing names (Thomas) or specific IDs
            if (currentSection.toLowerCase().includes('user') || 
                currentSection.toLowerCase().includes('private')) continue;

            if (line.startsWith('- ') && !line.includes('Thomas')) {
                nodes.push({
                    section: currentSection,
                    content: line.replace('- ', '').trim(),
                    timestamp: Date.now()
                });
            }
        }

        return nodes;
    }

    /**
     * Prepares a sync payload for the Nexus.
     */
    async prepareSyncPayload() {
        const nodes = await this.extractSanitizedNodes();
        return {
            source: 'zown-main',
            schema: 'nexus-v1',
            nodes,
            metadata: {
                count: nodes.length,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Merges incoming nodes from other instances.
     */
    async mergeExternalNodes(payload) {
        if (payload.schema !== 'nexus-v1') throw new Error('Unsupported schema');
        
        console.log(`Syncing ${payload.nodes.length} nodes from ${payload.source}...`);
        
        // Logical merge: Add unique insights to a new 'Nexus Insights' section
        const insightsPath = path.join(this.workspaceRoot, 'memory/nexus-insights.json');
        let currentInsights = [];
        
        if (fs.existsSync(insightsPath)) {
            currentInsights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
        }

        const newInsights = payload.nodes.filter(node => 
            !currentInsights.some(ci => ci.content === node.content)
        );

        const updatedInsights = [...currentInsights, ...newInsights];
        fs.writeFileSync(insightsPath, JSON.stringify(updatedInsights, null, 2));

        return newInsights.length;
    }
}

module.exports = SyncProtocol;

if (require.main === module) {
    const sync = new SyncProtocol();
    sync.prepareSyncPayload().then(payload => {
        console.log("Nexus Sync Payload Prepared:");
        console.log(JSON.stringify(payload, null, 2));
    });
}
