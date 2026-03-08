// FILE: src/lib/db/queries.ts
import { db } from './index'
import {
  workspaces, agents, knowledgeEntries, calls, webhookDeliveries,
  type NewAgent, type NewCall, type NewKnowledgeEntry,
} from './schema'
import { eq, desc, and, gte, lte, sql, count, avg, isNotNull } from 'drizzle-orm'

// ─── Workspace ────────────────────────────────────────────────────────────────

export async function getWorkspace(id: string) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  return ws ?? null
}

export async function getDefaultWorkspace() {
  const [ws] = await db.select().from(workspaces).orderBy(workspaces.createdAt).limit(1)
  return ws ?? null
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(workspaceId: string) {
  return db.select().from(agents).where(eq(agents.workspaceId, workspaceId)).orderBy(desc(agents.createdAt))
}

export async function getAgent(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  return agent ?? null
}

export async function getAgentWithKnowledge(id: string) {
  const agent = await getAgent(id)
  if (!agent) return null
  const knowledge = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.agentId, id)).orderBy(knowledgeEntries.createdAt)
  return { ...agent, knowledgeBase: knowledge }
}

export async function createAgent(data: NewAgent) {
  const [agent] = await db.insert(agents).values(data).returning()
  return agent
}

export async function updateAgent(id: string, data: Partial<NewAgent>) {
  const [agent] = await db.update(agents).set({ ...data, updatedAt: new Date() }).where(eq(agents.id, id)).returning()
  return agent
}

export async function deleteAgent(id: string) {
  await db.delete(agents).where(eq(agents.id, id))
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export async function upsertKnowledge(agentId: string, entries: { id?: string; question: string; answer: string; category: string }[]) {
  await db.delete(knowledgeEntries).where(eq(knowledgeEntries.agentId, agentId))
  if (entries.length === 0) return []
  return db.insert(knowledgeEntries).values(entries.map(e => ({ agentId, question: e.question, answer: e.answer, category: e.category }))).returning()
}

// ─── Calls ────────────────────────────────────────────────────────────────────

export async function getCalls(workspaceId: string, opts?: {
  agentId?: string; status?: string; limit?: number; offset?: number; from?: Date; to?: Date
}) {
  const conditions = [eq(calls.workspaceId, workspaceId)]
  if (opts?.agentId) conditions.push(eq(calls.agentId, opts.agentId))
  if (opts?.status)  conditions.push(eq(calls.status, opts.status as any))
  if (opts?.from)    conditions.push(gte(calls.startTime, opts.from))
  if (opts?.to)      conditions.push(lte(calls.startTime, opts.to))

  const [data, totalResult] = await Promise.all([
    db.select().from(calls).where(and(...conditions)).orderBy(desc(calls.startTime)).limit(opts?.limit ?? 50).offset(opts?.offset ?? 0),
    db.select({ count: count() }).from(calls).where(and(...conditions)),
  ])
  return { data, total: totalResult[0]?.count ?? 0 }
}

export async function getCall(id: string) {
  const [call] = await db.select().from(calls).where(eq(calls.id, id)).limit(1)
  return call ?? null
}

export async function getCallByRoom(roomName: string) {
  const [call] = await db.select().from(calls).where(eq(calls.roomName, roomName)).limit(1)
  return call ?? null
}

export async function createCall(data: NewCall) {
  const [call] = await db.insert(calls).values(data).returning()
  return call
}

export async function updateCall(id: string, data: Partial<NewCall>) {
  const [call] = await db.update(calls).set(data).where(eq(calls.id, id)).returning()
  return call
}

export async function updateCallByRoom(roomName: string, data: Partial<NewCall>) {
  const [call] = await db.update(calls).set(data).where(eq(calls.roomName, roomName)).returning()
  return call
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000)

  // Use drizzle ORM queries instead of raw SQL to avoid iteration issues
  const [totals, sentimentRows, agentPerf, prevTotals] = await Promise.all([
    db.select({
      total:       count(),
      avgDuration: avg(calls.durationSeconds),
      resolved:    sql<number>`cast(sum(case when ${calls.resolvedWithoutEscalation} then 1 else 0 end) as int)`,
    }).from(calls).where(and(eq(calls.workspaceId, workspaceId), gte(calls.startTime, since))),

    db.select({ sentiment: calls.sentiment, total: count() })
      .from(calls)
      .where(and(eq(calls.workspaceId, workspaceId), gte(calls.startTime, since), isNotNull(calls.sentiment)))
      .groupBy(calls.sentiment),

    db.select({
      agentId:   calls.agentId,
      agentName: calls.agentName,
      total:     count(),
      avgDur:    avg(calls.durationSeconds),
      resolved:  sql<number>`cast(sum(case when ${calls.resolvedWithoutEscalation} then 1 else 0 end) as int)`,
    }).from(calls).where(and(eq(calls.workspaceId, workspaceId), gte(calls.startTime, since))).groupBy(calls.agentId, calls.agentName),

    db.select({ total: count() }).from(calls).where(and(
      eq(calls.workspaceId, workspaceId),
      gte(calls.startTime, new Date(since.getTime() - days * 86400000)),
      lte(calls.startTime, since),
    )),
  ])

  const cur = totals[0]
  const totalCalls = Number(cur?.total ?? 0)
  const avgDur     = Math.round(Number(cur?.avgDuration ?? 0))
  const resolved   = Number(cur?.resolved ?? 0)
  const resRate    = totalCalls > 0 ? Math.round((resolved / totalCalls) * 100) : 0

  // Sentiment
  const sentMap: Record<string, number> = { positive: 0, neutral: 0, negative: 0 }
  let sentTotal = 0
  for (const r of sentimentRows) {
    if (r.sentiment) { sentMap[r.sentiment] = Number(r.total); sentTotal += Number(r.total) }
  }
  const sentPct = (k: string) => sentTotal > 0 ? Math.round((sentMap[k] / sentTotal) * 100) : 0

  // Build callsByDay using simple drizzle query
  const dayRows = await db.select({
    date:     sql<string>`to_char(date_trunc('day', ${calls.startTime}), 'YYYY-MM-DD')`,
    total:    count(),
    resolved: sql<number>`cast(sum(case when ${calls.resolvedWithoutEscalation} then 1 else 0 end) as int)`,
  }).from(calls)
    .where(and(eq(calls.workspaceId, workspaceId), gte(calls.startTime, since)))
    .groupBy(sql`date_trunc('day', ${calls.startTime})`)
    .orderBy(sql`date_trunc('day', ${calls.startTime})`)

  const dayMap = new Map<string, { calls: number; resolved: number }>()
  for (const r of dayRows) {
    dayMap.set(r.date, { calls: Number(r.total), resolved: Number(r.resolved) })
  }
  const callsByDay = Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10)
    return { date: d, calls: dayMap.get(d)?.calls ?? 0, resolved: dayMap.get(d)?.resolved ?? 0 }
  })

  // callsByHour
  const hourRows = await db.select({
    hour:  sql<number>`cast(extract(hour from ${calls.startTime}) as int)`,
    total: count(),
  }).from(calls)
    .where(and(eq(calls.workspaceId, workspaceId), gte(calls.startTime, since)))
    .groupBy(sql`extract(hour from ${calls.startTime})`)

  const hourMap = new Map<number, number>()
  for (const r of hourRows) hourMap.set(Number(r.hour), Number(r.total))
  const callsByHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, calls: hourMap.get(h) ?? 0 }))

  const prevCalls = Number(prevTotals[0]?.total ?? 0)
  const delta = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100 * 10) / 10 : 0

  return {
    calls:           totalCalls,
    callsDelta:      delta(totalCalls, prevCalls),
    avgDuration:     avgDur,
    durationDelta:   0,
    resolutionRate:  resRate,
    resolutionDelta: 0,
    satisfactionScore: 0,
    satisfactionDelta: 0,
    callsByDay,
    callsByHour,
    sentimentBreakdown: {
      positive: sentPct('positive'),
      neutral:  sentPct('neutral'),
      negative: sentPct('negative'),
    },
    topIntents: [],
    agentPerformance: agentPerf.map(r => ({
      agentId:         r.agentId ?? '',
      agentName:       r.agentName,
      calls:           Number(r.total),
      avgDuration:     Math.round(Number(r.avgDur ?? 0)),
      resolutionRate:  Number(r.total) > 0 ? Math.round((Number(r.resolved) / Number(r.total)) * 100) : 0,
      satisfactionScore: 0,
    })),
  }
}

// ─── Agent Stats ──────────────────────────────────────────────────────────────

export async function getAgentStats(agentId: string) {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const weekStart  = new Date(Date.now() - 7 * 86400000)

  const [total, today, week] = await Promise.all([
    db.select({
      total:       count(),
      avgDuration: avg(calls.durationSeconds),
      resolved:    sql<number>`cast(sum(case when ${calls.resolvedWithoutEscalation} then 1 else 0 end) as int)`,
    }).from(calls).where(eq(calls.agentId, agentId)),

    db.select({ total: count() }).from(calls).where(and(eq(calls.agentId, agentId), gte(calls.startTime, todayStart))),
    db.select({ total: count() }).from(calls).where(and(eq(calls.agentId, agentId), gte(calls.startTime, weekStart))),
  ])

  const t = total[0]
  const tot = Number(t?.total ?? 0)
  return {
    totalCalls:        tot,
    avgDuration:       Math.round(Number(t?.avgDuration ?? 0)),
    resolutionRate:    tot > 0 ? Math.round((Number(t?.resolved) / tot) * 100) : 0,
    satisfactionScore: 0,
    callsToday:        Number(today[0]?.total ?? 0),
    callsThisWeek:     Number(week[0]?.total ?? 0),
  }
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export async function deliverWebhook(agentId: string, callId: string | null, event: string, url: string, payload: object) {
  const [delivery] = await db.insert(webhookDeliveries).values({ agentId, callId, event, url, payload, attempts: 1 }).returning()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VocalHQ-Event': event },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
    const responseText = await res.text().catch(() => '')
    await db.update(webhookDeliveries).set({ statusCode: res.status, response: responseText.slice(0, 500), success: res.ok }).where(eq(webhookDeliveries.id, delivery.id))
  } catch (err: any) {
    await db.update(webhookDeliveries).set({ response: err.message, success: false }).where(eq(webhookDeliveries.id, delivery.id))
  }
}