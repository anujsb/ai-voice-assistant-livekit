// FILE: src/app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { generateRoomName } from '@/lib/livekit'
import { getAgentWithKnowledge, createCall } from '@/lib/db/queries'
import { getWorkspaceId } from '@/lib/utils'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  try {
    const { agentId, callerName } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const agent = await getAgentWithKnowledge(agentId)
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const roomName = generateRoomName(agentId)

    // Room metadata — this is what the Python agent reads on connect
    const roomMetadata = JSON.stringify({
      agentConfig: {
        agentId:       agent.id,
        agentName:     agent.name,
        greeting:      agent.greeting,
        systemPrompt:  agent.systemPrompt,
        voiceConfig:   agent.voiceConfig ?? {},
        knowledgeBase: agent.knowledgeBase ?? [],
      }
    })

    // Create the LiveKit room WITH metadata so Python agent can read it
    const host = process.env.NEXT_PUBLIC_LIVEKIT_URL!.replace('wss://', 'https://')
    const roomService = new RoomServiceClient(
      host,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    )
    await roomService.createRoom({ name: roomName, metadata: roomMetadata, emptyTimeout: 300, maxParticipants: 10 })

    // Caller token
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      { identity: `caller-${nanoid(6)}`, name: callerName || 'Caller', ttl: 3600 }
    )
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true })

    // Save call record
    const call = await createCall({
      workspaceId: getWorkspaceId(),
      agentId,
      agentName:   agent.name,
      roomName,
      callerName:  callerName || 'Browser Caller',
      direction:   'inbound',
      status:      'ringing',
      startTime:   new Date(),
    })

    return NextResponse.json({
      token:      await at.toJwt(),
      roomName,
      callId:     call.id,
      agentId:    agent.id,
      agentName:  agent.name,
      greeting:   agent.greeting,
      livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    })
  } catch (err: any) {
    console.error('[token]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}