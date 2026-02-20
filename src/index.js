#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { determineModel } from './router.js';
import { storeInChroma } from './memory.js';
import { drift } from './drift.js';
import { startWebhookServer } from './webhook.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_INTERVAL = 5000;
const DRIFT_INTERVAL = 1000 * 60 * 60; // Drift every hour
let isExecuting = false;

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

    const rawTaskLine = pendingMatch[1].trim().split('\n')[0];
    const currentTask = rawTaskLine.replace(/^-\s+/, '');
    if (!currentTask) return;

    nowState = nowState.replace(rawTaskLine, '');
    nowState = nowState.replace(/\[Current State\]\n.*/, `[Current State]\nProcessing: ${currentTask}`);
    fs.writeFileSync(nowStatePath, nowState, 'utf8');

    isExecuting = true;
    console.log(`\n📥 Intercepted Task: ${currentTask}`);

    const route = await determineModel(currentTask);
    const thinkingLevel = route === 'gemini-3-pro' ? 'high' : 'low';
    console.log(`🚦 Subconscious Route: ${route} (Translating to --thinking ${thinkingLevel})`);

    const openClawProcess = spawn('openclaw', [
      'agent', 
      '--message', currentTask, 
      '--thinking', thinkingLevel,
      '--session-id', 'zown-governor-loop'
    ], { 
      env: process.env 
    });

    openClawProcess.stdout.on('data', (data) => {
      console.log(`🤖 OpenClaw: ${data.toString().trim()}`);
    });

    openClawProcess.stderr.on('data', (data) => {
      console.error(`🚨 OpenClaw ERROR: ${data.toString().trim()}`);
    });

    openClawProcess.on('close', async (code) => {
      if (code === 0) {
        console.log(`✅ Task complete. Consolidating memory...`);
        await storeInChroma(currentTask, { type: 'execution', model: route });
        
        let finalState = fs.readFileSync(nowStatePath, 'utf8');
        
        // --- THE PIPELINE AUTOMATION ---
        // If we just finished Stage 4, automatically queue Stage 6 (Git Push)
        const stageMatch = finalState.match(/\[Pipeline Stage\]\n(.*)/);
        if (stageMatch && stageMatch[1].trim().includes('4. Core Implementation')) {
          console.log(`🚀 Advancing Pipeline to Stage 6: PR Creation...`);
          
          // Advance the stage
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n6. PR Creation`);
          
          // Automatically queue the Git Push task
          const autoPushTask = `- Task: Stage 4 complete. Execute Stage 6: Run git status, add the new files, commit with an Agile formatted message, and git push to the remote repository.`;
          finalState = finalState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${autoPushTask}`);
        } else if (stageMatch && stageMatch[1].trim().includes('6. PR Creation')) {
          console.log(`🎉 Pipeline Complete. Resetting state...`);
          // Reset the stage so the Internal Monologue can listen for new webhooks
          finalState = finalState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\nNone. Awaiting Input.`);
        }

        finalState = finalState.replace(/\[Current State\]\n.*/, `[Current State]\nIdling.`);
        fs.writeFileSync(nowStatePath, finalState, 'utf8');
      } else {
        console.error(`❌ OpenClaw failed with exit code ${code}.`);
        let failState = fs.readFileSync(nowStatePath, 'utf8');
        failState = failState.replace(/\[Current State\]\n.*/, `[Current State]\nIdling.`);
        fs.writeFileSync(nowStatePath, failState, 'utf8');
      }
      isExecuting = false;
    });
  }, HEARTBEAT_INTERVAL);
}

startZoneGovernor();