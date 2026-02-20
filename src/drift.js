import { ChromaClient } from 'chromadb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new ChromaClient({ path: "http://localhost:8000" });

async function getLocalEmbedding(text) {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  });
  const data = await response.json();
  return data.embedding;
}

export async function drift() {
  console.log("🧬 Initiating Neuroplastic Drift...");
  
  try {
    const collection = await client.getOrCreateCollection({ name: "episodic_memory" });
    
    // Query last 5 successful executions to synthesize evolution
    const results = await collection.get({
      limit: 5,
      where: { type: "execution" }
    });

    if (!results.documents.length) {
      console.log("💤 No new memories to drift from.");
      return;
    }

    const context = results.documents.join("\n---\n");
    const prompt = `Review these recent successful task executions:\n${context}\n\nSynthesize ONE concise workflow improvement or core directive to improve future performance. Format: "- [EVOLUTION]: <insight>". Output ONLY the evolution line.`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'phi4-mini', prompt: prompt, stream: false })
    });

    const data = await response.json();
    console.log("Subconscious Response:", data.response); // Debug line
    const newEvolution = data.response.trim();

    if (newEvolution.includes("[EVOLUTION]") || newEvolution.length > 10) {
      // THE BRAIN STEM PROTECTION: Append only to the Cerebral Cortex
      const soulPath = path.resolve(__dirname, '../../SOUL.md');
      
      // Ensure the Evolution Log header exists
      let soulContent = fs.readFileSync(soulPath, 'utf8');
      if (!soulContent.includes('[EVOLUTION LOG]')) {
        fs.appendFileSync(soulPath, '\n\n--- \n## [EVOLUTION LOG]\n');
      }

      const evolutionEntry = `\n${new Date().toISOString().split('T')[0]}: ${newEvolution}`;
      
      fs.appendFileSync(soulPath, evolutionEntry);
      console.log(`✨ Neuroplasticity Engaged: ${newEvolution}`);
    }
  } catch (error) {
    console.error("🚨 Drift Failed:", error.message);
  }
}
