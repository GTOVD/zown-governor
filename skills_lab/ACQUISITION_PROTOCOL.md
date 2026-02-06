# Skill Acquisition & Verification Protocol (SAVP)

## 1. Identification
- Scrutinize `MISSION.md` and `SELF_SUSTAIN.md` for capability gaps.
- Identify missing tools (e.g., `solana-cli`, `stripe-api`).

## 2. Research & Documentation
- Read official documentation.
- Draft a local `RESEARCH.md` in `zown-governor/skills_lab/<skill_name>/`.
- Define safe boundaries for usage.

## 3. Sandboxed Verification
- Create `test_cases/` for the new skill.
- Run tests in a non-destructive, isolated environment.
- Log successes and failures.

## 4. Integration
- Add the verified skill to `TOOLS.md` or as a new `SKILL.md`.
- Update the Governor with the new capability for future task assignment.

## 5. Continuous Audit
- Periodically re-verify skill efficacy.
