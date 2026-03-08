// FILE: src/app/api/agent/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAgentWithKnowledge, updateCall, getCallByRoom } from '@/lib/db/queries'
import { getAgentResponse, analyzeCall } from '@/lib/groq'
import type { TranscriptEntry } from '@/lib/groq'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  try {
    const { agentId, userMessage, transcript = [], roomName, action } = await req.json()

    const agent = await getAgentWithKnowledge(agentId)
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    // Post-call analysis
    if (action === 'analyze') {
      const analysis = await analyzeCall(transcript)
      // Update DB call record if roomName provided
      if (roomName) {
        const call = await getCallByRoom(roomName)
        if (call) {
          await updateCall(call.id, {
            summary:                  analysis.summary,
            sentiment:                analysis.sentiment as any,
            resolvedWithoutEscalation:analysis.resolved,
          })
        }
      }
      return NextResponse.json({ analysis })
    }

    if (!userMessage) return NextResponse.json({ error: 'userMessage required' }, { status: 400 })

    const response = await getAgentResponse(
      { systemPrompt: agent.systemPrompt, knowledgeBase: agent.knowledgeBase, name: agent.name },
      transcript,
      userMessage,
    )

    // Append both user message and agent response to DB call transcript
    if (roomName) {
      const call = await getCallByRoom(roomName)
      if (call) {
        const now = new Date().toISOString()
        const existing = (call.transcript ?? []) as TranscriptEntry[]
        const newEntries: TranscriptEntry[] = [
          { id: nanoid(), role: 'user',  content: userMessage, timestamp: now },
          { id: nanoid(), role: 'agent', content: response,    timestamp: now },
        ]
        await updateCall(call.id, {
          transcript: [...existing, ...newEntries] as any,
        })
      }
    }

    return NextResponse.json({ response, agentName: agent.name, timestamp: new Date().toISOString() })
  } catch (err: any) {
    console.error('[agent/chat]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}