# Zown Governor

**Zown Governor** is an agentic governance tool designed to manage autonomy budgets, prioritize tasks, and ensure sustainable operation for AI agents.

## Features

- **Dynamic Budgeting:** Adjusts activity limits based on time of day (weekday/weekend) and user activity trends.
- **Task Prioritization:** Manages a backlog of tasks with priority levels (critical, high, medium, low).
- **Rate Limiting:** Protects against API rate limits with RPM (Requests Per Minute) and hourly caps.
- **State Management:** Persists state to a local JSON file.

## Installation

```bash
npm install -g zown-governor
```

## Usage

Initialize the state in your working directory:
```bash
zown-governor init
```

Add a task:
```bash
zown-governor add "My New Task" high "Description here"
```

Fetch the next task (respecting budget):
```bash
zown-governor next
```

Complete a task:
```bash
zown-governor complete task-123456789 "Done"
```

Check status:
```bash
zown-governor status
```

## Configuration

The `state.json` file contains configuration for limits:

```json
"config": {
    "dailyLimit": 500,
    "hourlyLimit": 50,
    "rpmLimit": 10
}
```

## License

MIT
