// FILE: src/app/api/twilio/voice/route.ts
// Twilio calls this when someone dials your Twilio number.
// It generates a LiveKit room + connects Twilio media stream to it.
import { NextRequest, NextResponse } from 'next/server'
import { generateRoomName, createAgentToken } from '@/lib/livekit'
import { getAgents, createCall, getDefaultWorkspace } from '@/lib/db/queries'
import { getWorkspaceId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const callerPhone = body.get('From') as string ?? 'Unknown'
  const callerName  = body.get('CallerName') as string ?? 'Phone Caller'

  // Get first active agent for this workspace
  const agents = await getAgents(getWorkspaceId())
  const agent  = agents.find(a => a.status === 'active') ?? agents[0]

  if (!agent) {
    // No agents configured — tell caller
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, no agents are available right now. Please call back later.</Say>
  <Hangup/>
</Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  const roomName = generateRoomName(agent.id)

  // Save call to DB
  await createCall({
    workspaceId: getWorkspaceId(),
    agentId:     agent.id,
    agentName:   agent.name,
    roomName,
    callerName,
    callerPhone,
    direction:   'inbound',
    status:      'ringing',
    startTime:   new Date(),
  })

  // TwiML that connects Twilio audio to LiveKit via Media Streams
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${new URL(appUrl).host}/api/twilio/stream">
      <Parameter name="roomName" value="${roomName}"/>
      <Parameter name="agentId" value="${agent.id}"/>
      <Parameter name="agentName" value="${agent.name}"/>
      <Parameter name="greeting" value="${agent.greeting.replace(/"/g, '&quot;')}"/>
      <Parameter name="callerPhone" value="${callerPhone}"/>
    </Stream>
  </Connect>
</Response>`

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}