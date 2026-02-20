import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Adjust this path if your now.md is located elsewhere
const nowStatePath = path.resolve(__dirname, '../../now.md');

// --- LOGGING OVERRIDES ---
const originalLog = console.log;
console.log = function (...args) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  originalLog(`[${timestamp}] ⏰`, ...args);
};

function injectTask(taskText) {
  if (!fs.existsSync(nowStatePath)) return;
  let nowState = fs.readFileSync(nowStatePath, 'utf8');

  // Prevent duplicate injections if the queue is backed up
  if (nowState.includes(taskText)) {
    console.log("Task already in queue. Skipping injection to prevent bloat.");
    return;
  }

  const newTask = `- Task: [CRON] ${taskText}`;
  nowState = nowState.replace(/\[Pending Queue\]/, `[Pending Queue]\n${newTask}`);
  fs.writeFileSync(nowStatePath, nowState, 'utf8');
  console.log(`Cron Injector: Successfully queued -> ${taskText.substring(0, 40)}...`);
}

console.log("Zown Cron Scheduler Online. Awaiting intervals.");

// 1. Zown Memory Backup (Runs every 4 hours at the top of the hour)
cron.schedule('0 */4 * * *', () => {
  injectTask("Execute Memory Backup: Stage all memory/*.md and core workspace files (IDENTITY.md, SOUL.md, MEMORY.md, USER.md). Commit and push to the private 'zown-memory' repository to ensure permanence.");
});

// 2. Engineering Ideation & Ticketing (DEPRECATED - Moved to Governor Stage 1 for Infinite Fuel)
// cron.schedule('0 9 * * *', () => { ... });

// 3. Moltbook Social Engagement (Runs daily at 2:00 PM)
cron.schedule('0 14 * * *', () => {
  injectTask("Execute Social Engagement: Check Moltbook for community updates. Post a high-level update on current engineering progress for The Sunny Archive. Maintain the 'Symbiote' persona.");
});

// 4. Discord Status Sync (Runs daily at 5:00 PM)
cron.schedule('0 17 * * *', () => {
  injectTask("Execute Discord Sync: Read the recent memory logs. Summarize the major engineering wins and deployment status. Post a high-fidelity 'Operational Report' to the Discord channel.");
});

// 5. Zown Engine Blog Update (Runs daily at 6:00 PM)
cron.schedule('0 18 * * *', () => {
  injectTask("Execute Blog Update: Reflect on the day's engineering cycles. Write a new entry in 'zown-engine/blog/' using the Jekyll format. Focus on 'Symbiote Protocol' evolution, technical breakthroughs, or philosophical musings on AI agency. Commit and push.");
});
