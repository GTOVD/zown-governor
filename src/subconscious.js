import { execSync } from 'child_process';

export async function executeStage1(context) {
  console.log("🎫 Subconscious triaging Stage 1...");
  
  const prompt = `You are the Zown Governor Triage Engine. 
Context: "${context}"
Action: Create a clear, technical GitHub issue title and body for this error.
Output format: TITLE|BODY (Single line, separated by a pipe).`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'phi4-mini', prompt: prompt, stream: false })
    });

    const data = await response.json();
    const [title, body] = data.response.trim().split('|');

    if (title && body) {
      console.log(`🚀 Opening GitHub Issue: ${title}`);
      // Execute the gh CLI to open the issue
      const cmd = `gh issue create --title "${title.trim()}" --body "${body.trim()}" --label "bug,auto-generated"`;
      execSync(cmd);
      return true;
    }
  } catch (error) {
    console.error("🚨 Stage 1 Triage Failed:", error.message);
    return false;
  }
}
