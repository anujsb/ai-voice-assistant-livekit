// FILE: src/lib/groq.ts
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface TranscriptEntry {
  id: string
  role: 'agent' | 'user'
  content: string
  timestamp: string
}

interface AgentConfig {
  systemPrompt: string
  knowledgeBase: { question: string; answer: string }[]
  name: string
}

function buildSystemPrompt(agent: AgentConfig): string {
  const kb = agent.knowledgeBase.length > 0
    ? `\n\nKNOWLEDGE BASE:\n${agent.knowledgeBase.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')}`
    : ''
  return `${agent.systemPrompt}${kb}

CRITICAL VOICE RULES:
- Keep every response to 1-3 sentences max (this is a phone call)
- Never use markdown, lists, bullet points, or special characters
- Speak naturally as you would in a real phone conversation`
}

export async function getAgentResponse(
  agent: AgentConfig,
  history: TranscriptEntry[],
  userMessage: string,
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: buildSystemPrompt(agent) },
      ...history.slice(-12).map(t => ({
        role: t.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: t.content,
      })),
      { role: 'user', content: userMessage },
    ],
    max_tokens: 150,
    temperature: 0.7,
  })
  return completion.choices[0]?.message?.content ?? "I'm sorry, could you repeat that?"
}

export async function analyzeCall(transcript: TranscriptEntry[]): Promise<{
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  intent: string
  resolved: boolean
  keyPoints: string[]
}> {
  if (transcript.length === 0) {
    return { summary: 'No conversation recorded.', sentiment: 'neutral', intent: 'Unknown', resolved: false, keyPoints: [] }
  }

  const text = transcript
    .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.content}`)
    .join('\n')

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a call analytics expert. Respond only with valid JSON, no markdown.' },
      {
        role: 'user',
        content: `Analyze this call transcript. Return JSON with exactly:
{
  "summary": "2-3 sentence summary",
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "primary reason for call",
  "resolved": true | false,
  "keyPoints": ["point 1", "point 2"]
}

TRANSCRIPT:
${text}`,
      }
    ],
    max_tokens: 400,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })

  try {
    const r = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
    return {
      summary:   r.summary   ?? 'Call completed.',
      sentiment: r.sentiment ?? 'neutral',
      intent:    r.intent    ?? 'General Inquiry',
      resolved:  r.resolved  ?? false,
      keyPoints: r.keyPoints ?? [],
    }
  } catch {
    return { summary: 'Call completed.', sentiment: 'neutral', intent: 'General Inquiry', resolved: false, keyPoints: [] }
  }
}

export async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
  // Convert ArrayBuffer → Uint8Array → Blob (avoids Buffer type issues)
  const uint8 = new Uint8Array(audioBuffer)
  const blob = new Blob([uint8], { type: 'audio/webm' })
  const file = new File([blob], 'audio.webm', { type: 'audio/webm' })

  const result = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    language: 'en',
    response_format: 'text',
  })
  return typeof result === 'string' ? result : (result as any).text ?? ''
}