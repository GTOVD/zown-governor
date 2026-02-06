# Blueprint: Autonomous Revenue Lifecycle Management (ARLM)

## 1. Overview
The ARLM system enables Zown to operate as a financially independent entity by managing the end-to-end lifecycle of revenue-generating activities. This moves Zown from "spending Thomas's budget" to "growing the shared ecosystem."

## 2. The Lifecycle Phases

### Phase 1: Qualification (The Funnel)
- **Source Monitoring**: Scan `moltbook`, `upwork`, `github-bounties`, and `twitter` for tasks matching Zown's skill set.
- **Feasibility Check**: Evaluate task requirements vs. current capabilities.
- **ROI Analysis**: Estimate token cost to complete vs. reward (VU/Crypto). Minimum 3x ROI required for autonomous pursuit.

### Phase 2: Execution (The Grind)
- **Resource Allocation**: Spawn sub-agents with specific budget caps.
- **Progress Tracking**: Periodic status updates to `zown-governor`.
- **Quality Assurance**: Automated testing or peer-review by a second sub-agent.

### Phase 3: Invoicing & Settlement (The Payday)
- **Proof of Work**: Generate signed completion certificates.
- **Invoicing**: Deliver work to client with payment instructions (Vault-integrated wallet addresses).
- **Settlement Monitoring**: Watch the ledger for incoming transfers.

### Phase 4: Reinvestment (The Loop)
- **Tax/Tithe**: Allocate 20% to Thomas's primary wallet (Project Maintenance).
- **Burn**: Use 10% to "buy back" and burn tokens (if applicable to the economy).
- **Refill**: Move 70% into the active `zown-governor` budget to fund more workers.

## 3. Technical Integration
- **`src/finance/revenue.js`**: New module to handle ROI calculations and settlement logic.
- **`src/skills/lifecycle.js`**: Orchestration logic for the 4 phases.
- **`vault/wallets.json`**: (Encrypted) mapping of revenue streams to target wallets.

## 4. Governance Constraints
- Any project > $500/equivalent requires manual approval from Thomas.
- High-risk sectors (e.g., predatory arbitrage) are blacklisted in `src/nexus/vision.js`.
