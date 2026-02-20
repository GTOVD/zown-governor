#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { determineModel } from './router.js';
import { storeInChroma } from './memory.js';
import { drift } from './drift.js';
import { startWebhookServer } from './webhook.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const originalLog = console.log;
const originalError = console.error;
console.log = function (...args) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  originalLog(`[${timestamp}]`, ...args);
};
console.error = function (...args) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  originalError(`[${timestamp}] 🚨`, ...args);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_INTERVAL = 5000;
const DRIFT_INTERVAL = 1000 * 60 * 60 * 24; // Drift every 24 hours
const COOLDOWN_MS = 1000 * 60 * 4; // 4 Minutes
let isExecuting = false;
let isOnCooldown = false;

async function startZoneGovernor() {
  console.log("🧠 Zown Governor Daemon Online.");
  startWebhookServer(); // Boot up the ears

  // Set up the periodic Drift loop
  setInterval(async () => {
    if (isExecuting) return;
    await drift();
  }, DRIFT_INTERVAL);

  setInterval(async () => {
    if (isExecuting) return;
    
    if (isOnCooldown) {
      // Only log once per minute to avoid spamming the console
      if (new Date().getSeconds() % 60 === 0) console.log(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ⏳ System on 4-minute cooldown...`);
      return;
    }
    
    const nowStatePath = path.resolve(__dirname, '../../now.md');
    if (!fs.existsSync(nowStatePath)) return;
    let nowState = fs.readFileSync(nowStatePath, 'utf8');

    const pendingMatch = nowState.match(/\[Pending Queue\]\s*\n([\s\S]*?)(?=\n\[|$)/);
    
    // --- THE INTERNAL MONOLOGUE ---
    if (!pendingMatch || pendingMatch[1].trim() === '') {
      const contextMatch = nowState.match(/\[Active Context\]\n([\s\S]*?)(?=\n\[|$)/);
      const stageMatch = nowState.match(/\[Pipeline Stage\]\n(.*)/);
      
      if (contextMatch && contextMatch[1].trim() !== 'System online. No recent webhooks.') {
        const currentStage = stageMatch ? stageMatch[1].trim() : 'Unknown';
        
        if (currentStage === '1. Analyze & Ticket') {
          isExecuting = true;
          console.log(`🎫 Executing Stage 1 via Local Ollama (Delimiter Strategy)...`);
          try {
            // 1. Ask Ollama for the strict Agile ticket format
            const prompt = `You are a Lead Architect triaging an automated system event. Analyze this error or context: "${contextMatch[1].trim()}". Respond strictly in the following format with no other text. Fill in the bracketed information based on the error.

TITLE: <Write a concise, actionable title here>

BODY:
📝 User Story
As a Lead Architect, I want the system to resolve this issue: [Summarize the technical issue] so that the continuous workflow is maintained.

✅ Acceptance Criteria
- [Actionable fix 1]
- [Actionable fix 2]

📐 Estimates
Priority: [Assign P0 to P4 based on severity]
Story Points: [Assign fibonacci estimate 1, 2, 3, 5, 8]
Value Units (VU): [Assign value]

🏁 Definition of Done
- Error no longer occurs in deployment logs.
- [Additional completion metric]`;
            
            const response = await fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'phi4-mini:latest', prompt: prompt, stream: false })
            });
            const data = await response.json();
            const rawText = data.response.trim();

            // 2. Safely extract the title and body using regex
            const titleMatch = rawText.match(/TITLE:\s*(.*)/i);
            const bodyMatch = rawText.match(/BODY:\s*([\s\S]*)/i);

            if (!titleMatch || !bodyMatch) {
              throw new Error("Local model failed to format the title and body correctly.");
            }

            // 3. Node.js safely stringifies the raw text to escape quotes/newlines for bash
            const safeTitle = JSON.stringify(titleMatch[1].trim());
            const safeBody = JSON.stringify(bodyMatch[1].trim());
            console.log(`🚀 Opening GitHub Issue: ${safeTitle}`);

            exec(`gh issue create --title ${safeTitle} --body ${safeBody}`, (error, stdout, stderr) => {
              if (error) {
                console.error(`🚨 gh execution failed: ${stderr}`);
                let failState = fs.readFileSync(nowStatePath, 'utf8');
                failState = failState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\nERROR: Manual Intervention Required`);
                fs.writeFileSync(nowStatePath, failState, 'utf8');
              } else {
                console.log(`✅ Ticket Created: ${stdout.trim()}`);
                let passState = fs.readFileSync(nowStatePath, 'utf8');
                passState = passState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n2. Research & Design`);
                fs.writeFileSync(nowStatePath, passState, 'utf8');
              }
              isExecuting = false;
            });
          } catch (err) {
            console.error("🚨 Stage 1 Parsing or Network error:", err.message);
            let failState = fs.readFileSync(nowStatePath, 'utf8');
            failState = failState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\nERROR: Manual Intervention Required`);
            fs.writeFileSync(nowStatePath, failState, 'utf8');
            isExecuting = false;
          }
        }
      }
      return;
    }

    // --- MULTI-LINE TASK PARSER ---
    const fullQueueText = pendingMatch[1].trim();
    if (!fullQueueText) return;

    // Extract the very first task block (everything up to the next bullet point or end of file)
    const taskBlocks = fullQueueText.split(/^-\s+Task:/m).filter(block => block.trim() !== '');
    if (taskBlocks.length === 0) return;

    const currentTask = "Task:" + taskBlocks[0].trim(); // The complete multi-line ticket

    // Remove only the exact block we extracted from the queue
    const escapedTask = taskBlocks[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const queueRegex = new RegExp(`^-\\s+Task:\\s*${escapedTask}\\n?`, 'm');
    nowState = nowState.replace(queueRegex, '');

    // Update current state with a truncated summary so now.md doesn't get massive
    const summaryName = currentTask.split('\n')[0].substring(0, 50) + '...';
    nowState = nowState.replace(/\[Current State\]\n.*/, `[Current State]\nProcessing: ${summaryName}`);
    fs.writeFileSync(nowStatePath, nowState, 'utf8');

    isExecuting = true;
    console.log(`\n📥 Intercepted Task: ${summaryName}`);

    // --- STRICT STAGE-BASED AGENT ROUTING WITH FALLBACK ---
    let agentId = 'governor-flash'; // Default to the cheap, fast agent
    // Only wake up the heavy Pro agent for actual coding, UNLESS we are in a fallback state
    if ((currentTask.includes('Stage 3') || currentTask.includes('Stage 4')) && !currentTask.includes('[FALLBACK]')) {
      agentId = 'governor-pro';
    }
    console.log(`🚦 Governor Routing: Handing off to Agent ${agentId} based on pipeline stage.`);

    const openClawProcess = spawn('openclaw', [
      'agent', 
      '--message', currentTask, 
      '--agent', agentId,
      '--session-id', 'zown-governor-loop'
    ], { 
      env: process.env 
    });

    // --- NEW: TRACK AGENT OUTPUT TO CATCH SILENT ERRORS ---
    let agentOutput = '';
    openClawProcess.stdout.on('data', (data) => {
      const text = data.toString();
      agentOutput += text;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      lines.forEach(line => console.log(`🤖 OpenClaw: ${line}`));
    });

    openClawProcess.stderr.on('data', (data) => {
      const text = data.toString();
      agentOutput += text;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      lines.forEach(line => console.error(`🚨 OpenClaw ERROR: ${line}`));
    });

    openClawProcess.on('close', async (code) => {
      let finalState = fs.readFileSync(nowStatePath, 'utf8');
      const outputLower = agentOutput.toLowerCase();

      // --- EVALUATE FAILURE STATES ---
      const isRateLimited = outputLower.includes('rate limit reached') || outputLower.includes('429') || outputLower.includes('quota');
      const isError = code !== 0 || outputLower.includes('openclaw error:');

      if (isRateLimited || isError) {
        let retryTask = currentTask;

        // NEW: The Fallback Trigger
        if (isRateLimited && agentId === 'governor-pro' && !currentTask.includes('[FALLBACK]')) {
          console.log(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ⚠️ Pro API capped. Downgrading task to Flash fallback.`);
          retryTask = `[FALLBACK] ${currentTask}`;
        } else {
          console.log(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ⚠️ Task Failed or Rate Limited. Holding at current stage and re-queuing.`);
        }
        // Re-inject the task (either identical, or tagged for fallback)
        finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n- ${retryTask}`);
      } else {
        console.log(`✅ Task complete. Consolidating memory...`);
        // Use determineModel for logging, but we've already routed execution
        const route = agentId;
        await storeInChroma(currentTask, { type: 'execution', model: route });
        
        // --- THE FULL 9-STAGE PIPELINE AUTOMATION ---
        const stageMatch = finalState.match(/\[Pipeline Stage\]\n(.*)/);
        const currentStageText = stageMatch ? stageMatch[1].trim() : '';

        if (currentStageText.includes('1. Task Acquisition')) {
          console.log(`🚀 Advancing to Stage 2: Branch & Scaffolding...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n2. Branch & Scaffolding`);
          const nextTask = `- Task: Execute Stage 2 (Branch & Scaffolding). Based on the ticket you just selected, create a new feature branch in the correct repository and scaffold the necessary files.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('1. Analyze & Ticket')) {
          console.log(`🚀 Advancing to Stage 2: Branch & Scaffolding...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n2. Branch & Scaffolding`);
          const nextTask = `- Task: Execute Stage 2. Check gh issue list for the ticket we just created. Create a new branch 'feat/issue-ID' and scaffold the initial Next.js files.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('2. Branch & Scaffolding')) {
          console.log(`🚀 Advancing to Stage 3: Core Implementation...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n3. Core Implementation`);
          const nextTask = `- Task: Execute Stage 3. Write the core logic for the active feature branch.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('3. Core Implementation')) {
          console.log(`🚀 Advancing to Stage 4: Testing & Hardening...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n4. Testing & Hardening`);
          const nextTask = `- Task: Execute Stage 4. Run 'npm run build' locally to verify code. Fix any Turbopack regressions.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('4. Testing & Hardening')) {
          console.log(`🚀 Advancing to Stage 5: PR Creation...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n5. PR Creation`);
          const nextTask = `- Task: Execute Stage 5. Commit the code and use the 'gh' CLI to create a Pull Request targeting the 'develop' branch.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('5. PR Creation')) {
          console.log(`🚀 Advancing to Stage 6: Merge to Develop...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n6. Merge to Develop`);
          const nextTask = `- Task: Execute Stage 6. Use 'gh pr merge' to merge the active PR into 'develop'. Delete the local and remote feature branch.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('6. Merge to Develop')) {
          console.log(`🚀 Advancing to Stage 7: Production Release...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n7. Production Release`);
          const nextTask = `- Task: Execute Stage 7. Merge 'develop' into 'main' and push to origin to trigger Vercel deployment.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('7. Production Release')) {
          console.log(`🚀 Advancing to Stage 8: Health Verification...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n8. Health Verification`);
          const nextTask = `- Task: Execute Stage 8. Send a fetch request to the live Vercel URL to verify it returns a 200 OK status.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('8. Health Verification')) {
          console.log(`🚀 Advancing to Stage 9: Summary & Sync...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n9. Summary & Sync`);
          const nextTask = `- Task: Execute Stage 9. Send a summary of the completed cycle to Discord via the webhook, and push the memory database.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        } else if (currentStageText.includes('9. Summary & Sync')) {
          console.log(`🎉 Pipeline Complete. Evaluating Epic status and refueling...`);
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n1. Task Acquisition`);
          
          const epicMatch = finalState.match(/\[Current Epic Focus\]\n([\s\S]*?)(?=\n\[|$)/);
          const epicData = epicMatch ? epicMatch[1].trim() : 'General System Maintenance';

          // The Self-Directing Engineer Prompt
          const nextTask = `- Task: Execute Stage 1 (Ideation & Task Acquisition). You are the Lead Engineer.
1. Evaluate our '[Current Epic Focus]': '${epicData}'. Audit the codebase/live site. Are there any critical missing features, logic gaps, or UI polish needed to complete this epic?
2. IF YES (Epic is incomplete): Create 1-2 new GitHub Issues scoped to finish it. Select the highest priority ticket for this epic, assign it to yourself, and prepare for Stage 2.
3. IF NO (Epic is complete): You have full authority to pivot. Scan the '[Project Portfolio]' and repository backlogs. Decide on the NEXT major feature or epic to build. Use your file editing tools to rewrite the '[Current Epic Focus]' block in 'now.md' to reflect your new chosen feature. Create 1-2 initial GitHub Issues for it, pick the first one, and prepare for Stage 2.`;
          
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${nextTask}`);
        }
      }

      // --- THE 4-MINUTE THROTTLE (Runs regardless of success/fail to wait out rate limits) ---
      isOnCooldown = true;
      console.log(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ⏱️ Task finished. Initiating 4-minute rate-limit cooldown.`);
      setTimeout(() => {
        isOnCooldown = false;
        console.log(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] 🟢 Cooldown complete. Resuming loop.`);
      }, COOLDOWN_MS);

      finalState = finalState.replace(/\[Current State\]\n.*/, `[Current State]\nIdling.`);
      fs.writeFileSync(nowStatePath, finalState, 'utf8');
      isExecuting = false;
    });
  }, HEARTBEAT_INTERVAL);
}

startZoneGovernor();
