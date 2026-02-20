const HEAVY_KEYWORDS = ['the sunny archive', 'vercel', 'next.js', 'architecture', 'refactor', 'deployment.error'];

export async function determineModel(currentTask) {
  const taskLower = currentTask.toLowerCase();
  if (HEAVY_KEYWORDS.some(keyword => taskLower.includes(keyword))) {
    return 'gemini-3-pro';
  }

  const prompt = `Score complexity 1-10. 1-6=simple, 7-10=complex logic. Task: "${currentTask}". Output only a number.`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'phi4-mini', prompt: prompt, stream: false })
    });
    const data = await response.json();
    return parseInt(data.response.trim()) >= 8 ? 'gemini-3-pro' : 'gemini-3-flash';
  } catch (e) {
    return 'gemini-3-flash';
  }
}