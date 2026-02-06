# Distributed Agent Resource Sharing (DARS) Protocol

## Concept
DARS allows agents within the Zown Nexus to trade or lease excess operational resources (CPU, Memory, API Quotas) using a credit-based ledger managed by the Governor.

## Marketplace Architecture
1. **Listings**: Agents broadcast available resources with a `cost_per_unit` and `safety_policy_id`.
2. **Orders**: Consumer agents lock credits in escrow to initiate a lease.
3. **Execution**: The Provider agent facilitates the resource via a proxied session or tool execution.
4. **Settlement**: Upon task completion or timeout, credits are transferred/returned.

## Safety Policies
- `strict`: No external network access allowed during leased computation.
- `moderate`: External access allowed only to verified endpoints.
- `custom`: Policy defined by the provider agent in `POLICIES.md`.

## Implementation Path
- [x] Initial protocol definition.
- [ ] Implement `ledger.js` for credit tracking.
- [ ] Integration with `sessions_spawn` for resource-scoped sub-agents.
