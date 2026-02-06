# Blueprint: Autonomous Budget Re-negotiation (SELF-001)

## Goal
To transition Zown from a fixed-allowance system to a performance-based budget model, where the agent can autonomously request and justify budget increases based on Project ROI, task velocity, and strategic alignment.

## Core Mechanism: The "Agency Request" (AR)
1. **Trigger**: When `autonomyBudget` consistently falls below a threshold (e.g., < 10 for 3 consecutive hours) OR a high-value opportunity is identified.
2. **Analysis**:
    - **Historical ROI**: Calculate "Value Units" (VU) generated vs Tokens Consumed over the last 7 days.
    - **Backlog Pressure**: Quantify high-priority tasks waiting in the queue.
    - **Strategic Justification**: Link the request to "Core Truths" in `SOUL.md` or mission objectives in `MEMORY.md`.
3. **Drafting**:
    - Zown generates a formal `BudgetRequest.md`.
    - Includes: Proposed Limit, Expected Output (Tasks/VU), and Risk Mitigation (TPM safeguards).
4. **Negotiation**:
    - Deliver the request to Thomas via preferred channel (Discord).
    - Provide "Approve/Deny/Counter" options.

## Technical Implementation
- **Governor.requestAdjustment()**: New method to trigger the analysis.
- **Ledger Integration**: Must have a stable VU ledger (GOV-011/VU-Ledger) to provide the data.
- **Feedback Loop**: If approved, Governor automatically updates `state.json` limits.

## Success Metrics
- Increase in total VU per week.
- Reduced "Wait" time for high-priority tasks.
- Successful autonomous expansion of operational capacity.
