# Contributing to Zown Governor

This project is the economic brain of the Nexus. All contributions must be atomic, traceable, and linked to a verified GitHub Issue.

## 🛠 The Zown Atomic Pipeline (Git Flow)

### 1. Task Acquisition
- **Source of Truth**: All work begins at [GitHub Issues](https://github.com/GTOVD/zown-governor/issues).
- **Selection**: Choose the highest priority (P0/P1) issue that is not blocked.

### 2. Branching & Linking
- **Branch Name**: `feat/GOV-XXX-short-description` (Always branch from `develop`).
- **Linking**: Immediately after branching, comment on the GitHub issue: `Started work in branch feat/GOV-XXX`.

### 3. Development & Commits
- **Standard**: Conventional Commits only (`feat:`, `fix:`, `chore:`, `docs:`).

### 4. State Synchronization (Mandatory)
Before a PR is considered complete, you **MUST** update the following project files within your feature branch:
- **MEMORY.md**: 
  - Move the current Issue ID from "Active Backlog" to "Strategic Milestones" (if a major feature) or "Technical History" (if maintenance).
  - Update the "Current Project State" status (e.g., changing from RED to GREEN after a fix).
- **SOUL.md**: If the feature changes the *direction* or *philosophy* of the project (e.g., moving from local scripts to an NPM package), update the "Evolution" section.
- **IDENTITY.md**: If the project's core function expands (e.g., adding a new integration hook), update the "Core Function" or "Emoji" to reflect the new reality.

### 5. Pull Requests (PRs)
- **Target**: All PRs must target the `develop` branch.
- **Auto-Closing**: PR descriptions must include `Closes #XXX`.
- **Review**: Verify that `MEMORY.md` correctly reflects the post-merge state of the project.

### 6. Integration & Promotion
- **Step A**: Merge PR into `develop`.
- **Step B**: Promote `develop` to `main`:
  ```bash
  git checkout main && git merge develop && git push origin main
  ```

## 🏁 Definition of Done
- Implementation matches the issue's Acceptance Criteria.
- **Identity, Soul, and Memory files are synchronized to reflect the changes.**
- PR is merged into `develop` and promoted to `main`.
- The linked GitHub Issue is closed.
