import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const nowStatePath = path.resolve(__dirname, '../../now.md');

// 1. Listen for Vercel Deployment Errors
app.post('/webhook/vercel', (req, res) => {
  const payload = req.body;
  // We only care if the build failed
  if (payload.type === 'deployment.error') {
    const errorMsg = `🚨 Vercel Build Failed on Project: ${payload.payload.project.id}. Deployment URL: ${payload.payload.deployment.url}`;
    console.log(errorMsg);
    // Inject the crash into the Active Context
    updateActiveContext(errorMsg);
  }
  res.status(200).send('Vercel Webhook Received');
});

// 2. Listen for GitHub Activity (Issues, PRs, Comments)
app.post('/webhook/github', (req, res) => {
  const eventType = req.headers['x-github-event'];
  if (eventType === 'issue_comment') {
    const comment = req.body.comment.body;
    console.log(`💬 New GitHub Comment: ${comment}`);
    updateActiveContext(`New GitHub Comment received: "${comment}"`);
  }
  res.status(200).send('GitHub Webhook Received');
});

function updateActiveContext(newContext) {
  if (!fs.existsSync(nowStatePath)) return;
  let nowState = fs.readFileSync(nowStatePath, 'utf8');
  
  // Regex to replace everything under [Active Context] until the next bracket
  nowState = nowState.replace(/\[Active Context\]\n([\s\S]*?)(?=\n\[|$)/, `[Active Context]\n${newContext}\n`);
  
  // If the pipeline was idling, reset it to Stage 1 to analyze the new event
  nowState = nowState.replace(/\[Pipeline Stage\]\n.*/, `[Pipeline Stage]\n1. Analyze & Ticket`);
  
  fs.writeFileSync(nowStatePath, nowState, 'utf8');
}

export function startWebhookServer() {
  app.listen(3005, () => {
    console.log("📡 Zown Webhook Receiver active on port 3005");
  });
}
