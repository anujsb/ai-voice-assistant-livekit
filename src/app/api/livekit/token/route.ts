// FILE: src/app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createCallerToken, createAgentToken, generateRoomName } from '@/lib/livekit'
import { getAgentWithKnowledge, createCall } from '@/lib/db/queries'
import { getWorkspaceId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { agentId, callerName, callerPhone } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const agent = await getAgentWithKnowledge(agentId)
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const roomName = generateRoomName(agentId)

    // Save call record immediately (status: ringing)
    const call = await createCall({
      workspaceId: getWorkspaceId(),
      agentId,
      agentName: agent.name,
      roomName,
      callerName: callerName || null,
      callerPhone: callerPhone || null,
      direction: 'inbound',
      status: 'ringing',
      startTime: new Date(),
    })

    const [callerToken, agentToken] = await Promise.all([
      createCallerToken(roomName, callerName || 'Caller'),
      createAgentToken(roomName, agentId),
    ])

    return NextResponse.json({
      token: callerToken,
      agentToken,
      roomName,
      callId: call.id,
      agentId,
      agentName: agent.name,
      greeting: agent.greeting,
      // Send full agent config so Python agent can use it
      agentConfig: {
        agentId: agent.id,
        agentName: agent.name,
        greeting: agent.greeting,
        systemPrompt: agent.systemPrompt,
        voiceConfig: agent.voiceConfig,
        knowledgeBase: agent.knowledgeBase,
      },
      livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    })
  } catch (err: any) {
    console.error('[token]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}