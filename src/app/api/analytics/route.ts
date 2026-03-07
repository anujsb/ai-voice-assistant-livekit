// FILE: src/app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics } from '@/lib/db/queries'
import { getWorkspaceId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30

    const data = await getAnalytics(getWorkspaceId(), days)
    return NextResponse.json({ data, period })
  } catch (err: any) {
    console.error('[analytics]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}