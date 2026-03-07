// FILE: src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  getAgentWithKnowledge, updateAgent, deleteAgent,
  upsertKnowledge, getAgentStats,
} from '@/lib/db/queries'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await getAgentWithKnowledge(params.id)
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const stats = await getAgentStats(params.id)
    return NextResponse.json({ data: { ...agent, stats } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { knowledgeBase, ...agentFields } = body

    // Update agent fields
    const agent = await updateAgent(params.id, agentFields)

    // Upsert knowledge base if provided
    if (knowledgeBase !== undefined) {
      await upsertKnowledge(params.id, knowledgeBase)
    }

    const stats = await getAgentStats(params.id)
    return NextResponse.json({ data: { ...agent, stats } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteAgent(params.id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}