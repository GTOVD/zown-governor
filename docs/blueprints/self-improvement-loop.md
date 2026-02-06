# OPS-001: Continuous Self-Improvement Loop

## Objective
To automate the process of learning from failures and evolving our operational guidelines (AGENTS.md, TOOLS.md, SKILLS.md).

## Mechanism: The Post-Mortem Agent
A periodic cron job (or heartbeat check) that performs the following steps:

1. **Scan:** Query the `zown-governor` for tasks with status `failed` or those requiring multiple retries.
2. **Analyze:** For each failure, identify:
    - Was it a tool limitation?
    - Was it a lack of context/memory?
    - Was it an error in reasoning?
3. **Draft Fix:** Propose a specific text update to the relevant workspace file.
    - Example: Add a "Lesson Learned" to `AGENTS.md`.
    - Example: Add a specific CLI flag to `TOOLS.md`.
4. **Apply:** Automatically update the file (for low-risk changes) or create a "Meta-Task" for Thomas to review.

## Implementation: `governor learn`
We will implement a `learn` subcommand in the `zown-governor` CLI:
- `node zown-governor/bin/cli.js learn`
- This command will execute the Scan -> Analyze -> Draft flow.

## Initial Lessons to Codify
- **Commit Early:** Ensure files are staged before running multi-step transformations.
- **Budgeting:** Flag any task that exceeds its token budget by 50% for immediate review.

## Next Steps
- Implement the `learn` logic in the `governor` codebase.
- Add a periodic cron job to trigger the learning cycle.
