class SkillVerifier {
    constructor(sandbox) {
        this.sandbox = sandbox;
    }

    async verify(testPlan) {
        const results = [];
        console.log(`Starting verification for ${this.sandbox.skillName}`);

        for (const test of testPlan) {
            console.log(`Test: ${test.name}`);
            const result = await this.sandbox.execute(test.command);
            
            const passed = test.expected(result);
            results.push({
                test: test.name,
                passed,
                output: result.output,
                error: result.error
            });
        }

        const score = results.filter(r => r.passed).length / results.length;
        return {
            skill: this.sandbox.skillName,
            verifiedAt: new Date().toISOString(),
            score,
            details: results
        };
    }
}

module.exports = SkillVerifier;
