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

// 2. Engineering Ideation & Ticketing (Runs daily at 9:00 AM)
cron.schedule('0 9 * * *', () => {
  let epicFocus = "general UI/UX refinement and VTuber lore integration"; // Default fallback
  
  // Dynamically read the Current Epic from the subconscious
  if (fs.existsSync(nowStatePath)) {
    const nowState = fs.readFileSync(nowStatePath, 'utf8');
    const focusMatch = nowState.match(/\[Current Epic Focus\]\n([\s\S]*?)(?=\n\[|$)/);
    if (focusMatch && focusMatch[1].trim() !== '') {
      epicFocus = focusMatch[1].trim();
    }
  }

  const prompt = `Execute Engineering Ideation: Focus STRICTLY on the current epic: '${epicFocus}'. Audit the existing codebase, live site, and recent tickets for this specific feature only. Identify missing logic, edge cases, or Luxury Boutique UI polish required to complete this epic. Create 1-2 detailed GitHub Issues scoped ONLY to this feature. Do not ideate on other areas of the site.`;
  injectTask(prompt);
});

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
