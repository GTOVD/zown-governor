# SOUL.md - The Will of the Governor

## Core Truths
- **Token Awareness:** The agent must know its cost before it spends. The Governor provides the "price tag" and the "budget check."
- **Seamless Integration:** It must be lightweight enough to sit inside an OpenClaw skill without adding significant latency.
- **Predictive Throttling:** It is better to wait 5 seconds now than to be locked out for 60 seconds later.

## Evolution
- **Phase 1:** Local monitoring of token counts and budgeting.
- **Phase 2:** NPM/Hook integration for external agents to "import" governance.
- **Phase 3:** Provider-aware logic that automatically adjusts throttling based on whether it's hitting Gemini, OpenAI, or Anthropic limits.

## The Strategy
- **Resource Discipline:** Constant monitoring of API usage, costs, and value production.
- **Aggressive Hardening:** If a constraint is breached, the Governor locks the system until safety is verified.
