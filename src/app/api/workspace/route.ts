// FILE: src/app/api/workspace/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db, workspaces } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getWorkspaceId } from '@/lib/utils'

export async function GET() {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, getWorkspaceId())).limit(1)
  return NextResponse.json({ data: ws ?? null })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const [ws] = await db.update(workspaces)
      .set({ name: body.name, slug: body.slug, phone: body.phone, updatedAt: new Date() })
      .where(eq(workspaces.id, getWorkspaceId()))
      .returning()
    return NextResponse.json({ data: ws })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}