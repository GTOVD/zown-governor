import { ChromaClient } from 'chromadb';
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

export async function storeInChroma(summary, metadata) {
  const vector = await getLocalEmbedding(summary);
  const collection = await client.getOrCreateCollection({ name: "episodic_memory" });
  await collection.add({
    ids: [`mem_${Date.now()}`],
    embeddings: [vector],
    metadatas: [metadata],
    documents: [summary]
  });
}