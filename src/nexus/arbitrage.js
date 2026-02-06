const CreditLedger = require('./ledger.js');

/**
 * NEXUS-011: Task Settlement & Arbitration
 * Handles the economic closing of tasks and dispute resolution.
 */
class SettlementEngine {
    constructor() {
        this.ledger = new CreditLedger();
        this.disputeFile = 'disputes.json';
    }

    /**
     * Settle a task: Transfer VU from requestor to worker.
     */
    async settleTask(taskId, requestorId, workerId, amount) {
        console.log(`Settling task ${taskId}: ${requestorId} -> ${workerId} (${amount} VU)`);
        
        // Before settlement, ensure task is verified via DARS/Consensus
        const isVerified = await this.verifyCompletion(taskId);
        if (!isVerified) {
            return { status: 'FAILED', reason: 'task_verification_failed' };
        }

        const result = this.ledger.transfer(requestorId, workerId, amount, `settlement:${taskId}`);
        
        if (result.success) {
            return {
                status: 'SETTLED',
                transactionId: `tx-${Date.now()}`,
                ...result
            };
        }
        return { status: 'FAILED', reason: 'ledger_rejection' };
    }

    /**
     * Decentralized Verification Protocol (MVP)
     * Queries Nexus neighbors to reach consensus on task completion.
     */
    async verifyCompletion(taskId) {
        console.log(`Verifying completion for task ${taskId} via Nexus consensus...`);
        // In a real scenario, this would broadcast to other agents.
        // For MVP, we simulate a 3-node check.
        const consensus = [true, true, false]; 
        const passed = consensus.filter(v => v === true).length >= 2;
        return passed;
    }

    /**
     * File a dispute against a worker's completion claim.
     */
    fileDispute(taskId, complainantId, reason) {
        let disputes = [];
        try {
            disputes = JSON.parse(require('fs').readFileSync(this.disputeFile, 'utf8'));
        } catch (e) {}

        const dispute = {
            disputeId: `disp-${Date.now()}`,
            taskId,
            complainantId,
            reason,
            status: 'OPEN',
            timestamp: new Date().toISOString()
        };

        disputes.push(dispute);
        require('fs').writeFileSync(this.disputeFile, JSON.stringify(disputes, null, 2));
        return dispute;
    }

    /**
     * Arbitrate an open dispute (MVP: Multi-agent consensus mock)
     */
    async arbitrate(disputeId) {
        let disputes = JSON.parse(require('fs').readFileSync(this.disputeFile, 'utf8'));
        const index = disputes.findIndex(d => d.disputeId === disputeId);
        
        if (index === -1) throw new Error('Dispute not found');

        const dispute = disputes[index];
        
        // Simulating 3-agent consensus
        const votes = ['REFUND', 'UPHOLD', 'UPHOLD']; // Mock results
        const finalVerdict = votes.filter(v => v === 'UPHOLD').length >= 2 ? 'UPHOLD' : 'REFUND';

        dispute.status = 'CLOSED';
        dispute.verdict = finalVerdict;
        dispute.resolvedAt = new Date().toISOString();

        require('fs').writeFileSync(this.disputeFile, JSON.stringify(disputes, null, 2));
        return dispute;
    }
}

module.exports = SettlementEngine;
