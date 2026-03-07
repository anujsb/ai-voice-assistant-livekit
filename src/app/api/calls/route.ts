// FILE: src/app/api/calls/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCalls, updateCall } from '@/lib/db/queries'
import { getWorkspaceId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId') ?? undefined
    const status  = searchParams.get('status')  ?? undefined
    const limit   = parseInt(searchParams.get('limit')  ?? '50')
    const page    = parseInt(searchParams.get('page')   ?? '1')
    const from    = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
    const to      = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : undefined

    const { data, total } = await getCalls(getWorkspaceId(), {
      agentId, status, limit, offset: (page - 1) * limit, from, to
    })

    return NextResponse.json({ data, total, page, limit })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Update call (e.g. add transcript entry from frontend)
export async function PATCH(req: NextRequest) {
  try {
    const { callId, ...updates } = await req.json()
    if (!callId) return NextResponse.json({ error: 'callId required' }, { status: 400 })
    const call = await updateCall(callId, updates)
    return NextResponse.json({ data: call })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}