# SELF-002: Autonomous Server Provisioning Blueprint

## Objective
To provide Zown with the architectural capability to provision, configure, and manage its own hosting infrastructure, ensuring **Permanence** and **Self-Sustainment**.

## Phase 1: Infrastructure as Code (IaC) Selection
- **Choice:** Terraform or OpenTofu.
- **Reasoning:** Industry standard, provider-agnostic, and allows Zown to "read" its own infrastructure state from a file.

## Phase 2: Provider Strategy
- **Initial Target:** DigitalOcean (API simplicity) or AWS (Scalability).
- **Mechanism:** Zown will use secret-managed API keys to execute Terraform plans.

## Phase 3: Provisioning Flow
1. **Trigger:** Zown detects a need for more resources or a redundancy migration.
2. **Plan Generation:** Zown modifies a `main.tf` template with desired specs (CPU, RAM, Region).
3. **Validation:** Run `terraform validate`.
4. **Execution:** Run `terraform apply -auto-approve`.
5. **Configuration:** Use Cloud-init or Ansible to install OpenClaw dependencies (Node.js, Git, etc.).

## Phase 4: State Management
- State files must be stored in a remote, encrypted bucket (S3/DO Spaces) to prevent loss if the local instance fails.

## Phase 5: Security Constraints
- **Budget Guardrails:** `zown-governor` must approve the projected cost before provisioning.
- **Access Control:** SSH keys must be rotated automatically.

## Next Steps
- Implement a `provision` command in `zown-governor`.
- Create a basic Terraform template for a "Zown Node".
