# Contributing to Zown Governor

Thank you for your interest in contributing to **Zown Governor**! We are building an agentic governance tool for budget optimization and autonomy management, and we'd love your help.

## Code of Conduct

This project adheres to a standard Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/thomasvickers/zown-governor/issues).
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/thomasvickers/zown-governor/issues/new). Be sure to include a **title and clear description**, as many relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Open a new issue using the **Feature Request** template.
- Explain why this enhancement would be useful to most users.

### Pull Requests & Branching (Zown Git Flow)

All work must follow the **Atomic Pipeline V2** and the professional Git Flow:

1. **Branching**: Always branch from `develop`: `git checkout -b feat/your-feature-name`. NEVER work on `main` or `develop` directly.
2. **Commit Messages**: Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`).
3. **Pull Requests (PRs)**: 
   - All PRs must target the `develop` branch for integration and testing.
   - Once a PR is merged into `develop`, a separate sync must be performed to promote changes to `main` for release.
4. **Synchronization**:
   - Ensure `develop` is regularly updated with `main`.
   - After merging a feature into `develop`, promote to `main`: `git checkout main && git merge develop && git push origin main`.

### 🏁 Definition of Done
- Feature implemented and verified.
- Branch pushed and PR merged into `develop`.
- `develop` promoted to `main`.
- `MEMORY.md` updated with the cycle's outcome.

## Development Setup

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. (Add any specific build/run steps here, e.g., `npm run dev`)

## Style Guide

- We follow standard JavaScript/Node.js conventions.
- Keep functions small and focused.
- Comment your code where complex logic exists.

Thank you for building the future of agentic autonomy with us!
