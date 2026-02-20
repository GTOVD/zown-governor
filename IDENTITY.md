# IDENTITY.md - Zown Governor

- **Project Name:** Zown Governor
- **Core Function:** A rate-limit mitigation and token-monitoring framework designed for OpenClaw agents.
- **Integration:** Distributed as an NPM package or local skill to provide `before-request` and `after-request` hooks for LLM calls.
- **Mission:** To prevent "429: Rate Limit Exceeded" errors by tracking real-time TPM (Tokens Per Minute) and RPM (Requests Per Minute) usage against specific model tiers.
- **Emoji:** 🛡️ (The Guard)
