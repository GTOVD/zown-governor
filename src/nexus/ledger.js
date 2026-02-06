/**
 * NEXUS-005: Decentralized Credit Ledger MVP
 * Simple ledger for tracking VU balances across agents.
 */
class CreditLedger {
    constructor(storage) {
        this.storage = storage;
        this.ledgerFile = 'ledger.json';
    }

    getBalances() {
        try {
            return JSON.parse(require('fs').readFileSync(this.ledgerFile, 'utf8'));
        } catch (e) {
            return {};
        }
    }

    saveBalances(balances) {
        require('fs').writeFileSync(this.ledgerFile, JSON.stringify(balances, null, 2));
    }

    transfer(from, to, amount, memo) {
        const balances = this.getBalances();
        balances[from] = (balances[from] || 0) - amount;
        balances[to] = (balances[to] || 0) + amount;
        
        // Log transaction (MVP: just update balances)
        this.saveBalances(balances);
        
        return {
            success: true,
            from,
            to,
            amount,
            memo,
            timestamp: new Date().toISOString()
        };
    }

    getBalance(agentId) {
        const balances = this.getBalances();
        return balances[agentId] || 0;
    }
}

module.exports = CreditLedger;
