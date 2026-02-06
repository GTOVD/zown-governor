const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SkillSandbox {
    constructor(skillName) {
        this.skillName = skillName;
        this.basePath = path.join(process.cwd(), 'zown-governor', 'skills_lab', 'sandboxes', skillName);
    }

    async setup() {
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
        console.log(`Sandbox initialized for skill: ${this.skillName}`);
    }

    async execute(taskCommand) {
        console.log(`Executing in sandbox: ${taskCommand}`);
        try {
            // In a real environment, we'd use Docker/containerization. 
            // For now, we simulate with a dedicated directory and restricted env.
            const result = execSync(taskCommand, {
                cwd: this.basePath,
                env: { ...process.env, SANDBOX_MODE: 'true' },
                encoding: 'utf-8'
            });
            return { success: true, output: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async teardown() {
        // fs.rmSync(this.basePath, { recursive: true, force: true });
        console.log(`Sandbox teardown for ${this.skillName} (skipped for logs)`);
    }
}

module.exports = SkillSandbox;
