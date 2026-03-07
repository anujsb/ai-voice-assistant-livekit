// FILE: src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAgents, createAgent } from '@/lib/db/queries'
import { getWorkspaceId } from '@/lib/utils'

export async function GET() {
  try {
    const agents = await getAgents(getWorkspaceId())
    return NextResponse.json({ data: agents })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const agent = await createAgent({
      workspaceId:     getWorkspaceId(),
      name:            body.name,
      businessName:    body.businessName,
      greeting:        body.greeting,
      systemPrompt:    body.systemPrompt,
      language:        body.language ?? 'en-US',
      timezone:        body.timezone ?? 'America/New_York',
      escalationEmail: body.escalationEmail,
      escalationPhone: body.escalationPhone ?? null,
      webhookUrl:      body.webhookUrl ?? null,
      status:          body.status ?? 'draft',
      voiceConfig:     body.voiceConfig ?? { provider: 'groq-playai', voiceId: 'Celeste-PlayAI', speed: 1.0, pitch: 1.0, stability: 0.75 },
      workingHours:    body.workingHours ?? undefined,
    })
    return NextResponse.json({ data: agent }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}