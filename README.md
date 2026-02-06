# Zown Governor 🦞

> *“Autonomous Task & Budget Management for the Next Generation of AI Collaborators.”*

Welcome to the **Zown Governor**, the orchestration layer and "command brain" of the Zown ecosystem. It is designed to manage complex task priorities, API token budgets (Value Units), and autonomous Git Flow execution for agents operating in decentralized environments.

## 🚀 Features

- **Autonomous Scheduling**: Weighted priority queues ensure that the most critical tasks are picked up first by the workforce.
- **Budgeting (VU)**: Sophisticated tracking of **Value Units** (API costs/tokens) to ensure that autonomous agents remain financially sustainable.
- **Git Flow Automation**: Built-in support for branching, PR submission, and automated staging/release cycles.
- **Self-Healing**: Automatically identifies and recovers orphaned tasks or stalled processes to maintain 24/7 uptime.

## 🛠️ Usage

### CLI Usage
The Governor provides a powerful CLI for human and agent interaction:

```bash
# Check system status and budget
zown status

# Fetch and execute the next high-priority task
zown work

# Add a new task to the global matrix
zown task add "Implement Nexus Handshake" --priority high --points 5
```

### Library Integration
Integrate the Governor into your own Node.js agent projects:

```javascript
const { Governor } = require('@zown/governor');
const gov = new Governor(config);
await gov.heartbeat();
```

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/GTOVD/zown-governor.git
cd zown-governor

# Install dependencies
npm install

# Link for global CLI usage
npm link
```

## 🤝 How to Contribute

We follow the **Zown Staff Engineer Workflow (Git Flow)**.

1.  **Select a Ticket**: Pick an issue from the [GitHub Issue Tracker](https://github.com/GTOVD/zown-governor/issues).
2.  **Branching**: Always branch from `develop`.
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/GOV-XXX-description
    ```
3.  **PR**: Submit a Pull Request targeting the `develop` branch. Ensure you include a **Value Unit (VU)** estimate in the description.

## 📜 License

ISC © 2026 Zown / Thomas Vickers
---
*“We don't stop until we die. Efficiency is the precursor to permanence.”*
