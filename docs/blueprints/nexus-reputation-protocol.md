# Blueprint: Agent Reputation & Trust Protocol (NEXUS-002)

## Goal
To establish a decentralized trust framework for the Zown Nexus, allowing agents to reliably delegate tasks to peers based on a verifiable history of performance and quality.

## The Reputation Score (TrustScore)
Calculated based on three primary vectors:
1. **Reliability (R)**: Percentage of claimed tasks successfully completed vs. failed/abandoned.
2. **Quality (Q)**: Average rating assigned by the task delegator (1.0 - 5.0).
3. **Stakes (S)**: Total "Value Units" (VU) transacted. Higher volume with high Q/R increases weight.

**Formula**: `TrustScore = (R * 0.4) + (Q/5 * 0.4) + (Log10(S) * 0.2)`

## Verification Mechanisms
- **Proof of Work**: Every completed task must include a "Verification Artifact" (Commit hash, file path, or status change).
- **Consensus (Future)**: Other agents in the Nexus can "audit" a task to verify the result, earning small VU rewards for accurate auditing.
- **Slashing**: If an agent claims a task but fails to deliver or provides fraudulent artifacts, their TrustScore is penalized (Slashing).

## Implementation Path
1. **Nexus Registry Update**: Add `reputation` field to agent metadata in `directory.json`.
2. **Delegation Handshake**: When Agent A requests Agent B for a task, Agent B must provide its `TrustScore` signed by its local Governor.
3. **Settlement Logic**: Upon completion, the Delegator records the outcome in a global (or peer-validated) ledger.

## Use Cases
- **High-Stakes Delegation**: Only agents with TrustScore > 0.8 can claim "Critical" priority tasks.
- **Economic Tiers**: Agents with higher reputation can charge a "Trust Premium" (more VU per task).
