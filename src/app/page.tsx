// FILE: src/app/dashboard/page.tsx
import Link from 'next/link'
import { Phone, Clock, CheckCircle2, Star, ChevronRight, Zap, PhoneIncoming, AlertCircle } from 'lucide-react'
import { cn, formatDuration, timeAgo, sentimentBadge } from '@/lib/utils'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

async function getData() {
  try {
    const { getAnalytics, getCalls, getAgents, getDefaultWorkspace } = await import('@/lib/db/queries')
    const { getWorkspaceId } = await import('@/lib/utils')
    const wsId = getWorkspaceId()
    if (!wsId) return null

    const [analytics, { data: recentCalls }, agents, workspace] = await Promise.all([
      getAnalytics(wsId, 30),
      getCalls(wsId, { limit: 5 }),
      getAgents(wsId),
      getDefaultWorkspace(),
    ])
    return { analytics, recentCalls, agents, workspace }
  } catch (e) {
    console.error('[dashboard]', e)
    return null
  }
}

export default async function DashboardPage() {
  const data = await getData()

  // Not configured yet
  if (!data) {
    return (
      <div className="flex flex-col justify-center items-center gap-6 p-6 h-full min-h-[60vh]">
        <div className="flex justify-center items-center bg-yellow-500/10 border border-yellow-500/20 rounded-2xl w-14 h-14">
          <AlertCircle className="w-7 h-7 text-yellow-400" />
        </div>
        <div className="max-w-sm text-center">
          <h2 className="mb-2 font-semibold text-white text-xl">Setup Required</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Add your environment variables to <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">.env.local</code> and run the seed command to get started.
          </p>
        </div>
        <div className="space-y-1 bg-black/30 p-4 border border-white/10 rounded-xl w-full max-w-sm font-mono text-white/60 text-sm">
          <p className="text-green-400"># 1. Fill in .env.local</p>
          <p>DATABASE_URL=...</p>
          <p>LIVEKIT_API_KEY=...</p>
          <p>GROQ_API_KEY=...</p>
          <p className="mt-2 text-green-400"># 2. Push schema + seed</p>
          <p>pnpm db:push</p>
          <p>pnpm db:seed</p>
          <p className="mt-2 text-green-400"># 3. Add WORKSPACE_ID to .env.local</p>
        </div>
      </div>
    )
  }

  const { analytics, recentCalls, agents, workspace } = data

  const stats = [
    { label: 'Total Calls',     value: analytics.calls.toLocaleString(),          icon: Phone },
    { label: 'Avg Duration',    value: formatDuration(analytics.avgDuration),     icon: Clock },
    { label: 'Resolution Rate', value: `${analytics.resolutionRate}%`,            icon: CheckCircle2 },
    { label: 'Active Agents',   value: agents.filter(a => a.status === 'active').length.toString(), icon: Star },
  ]

  return (
    <div className="space-y-6 mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-bold text-white text-3xl">{workspace?.name ?? 'Dashboard'}</h1>
          <p className="mt-1 text-white/40 text-sm">
            Last 30 days · {agents.filter(a => a.status === 'active').length} agents active
          </p>
        </div>
        <Link href="/dashboard/agents/new" className="btn-primary">
          <Zap className="w-3.5 h-3.5" />
          New Agent
        </Link>
      </div>

      {/* Stats */}
      <div className="gap-4 grid grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="flex justify-center items-center bg-green-500/10 mb-3 rounded-lg w-8 h-8">
              <s.icon className="w-4 h-4 text-green-400" />
            </div>
            <p className="font-bold text-white text-2xl">{s.value}</p>
            <p className="mt-0.5 text-white/40 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart + Sentiment */}
      <div className="gap-4 grid lg:grid-cols-3">
        <div className="lg:col-span-2 card">
          <p className="mb-1 font-semibold text-white">Call Volume</p>
          <p className="mb-4 text-white/40 text-xs">30-day trend</p>
          <DashboardClient callsByDay={analytics.callsByDay} />
        </div>

        <div className="card">
          <p className="mb-1 font-semibold text-white">Sentiment</p>
          <p className="mb-4 text-white/40 text-xs">AI-analyzed</p>
          {analytics.calls === 0 ? (
            <div className="flex flex-col justify-center items-center py-8 text-white/30">
              <Phone className="opacity-20 mb-2 w-8 h-8" />
              <p className="text-sm">No calls yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Positive', v: analytics.sentimentBreakdown.positive, color: 'bg-green-500' },
                { label: 'Neutral',  v: analytics.sentimentBreakdown.neutral,  color: 'bg-white/30' },
                { label: 'Negative', v: analytics.sentimentBreakdown.negative, color: 'bg-red-500' },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-white/50">{s.label}</span>
                    <span className="font-medium text-white">{s.v}%</span>
                  </div>
                  <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div className={cn('rounded-full h-full', s.color)} style={{ width: `${s.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agents + Recent Calls */}
      <div className="gap-4 grid lg:grid-cols-2">
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <p className="font-semibold text-white">Agents</p>
            <Link href="/dashboard/agents" className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {agents.length === 0 ? (
            <div className="py-8 text-white/30 text-center">
              <p className="text-sm">No agents yet</p>
              <Link href="/dashboard/agents/new" className="block mt-1 text-green-400 text-xs">Create your first agent →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-colors">
                  <div className="flex flex-shrink-0 justify-center items-center bg-green-500/15 rounded-full w-7 h-7">
                    <span className="font-bold text-green-400 text-xs">{a.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{a.name}</p>
                    <p className="text-white/40 text-xs">{a.businessName}</p>
                  </div>
                  <span className={cn('text-[10px] badge',
                    a.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-white/40 border-white/10')}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <p className="font-semibold text-white">Recent Calls</p>
            <Link href="/dashboard/calls" className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {recentCalls.length === 0 ? (
            <div className="py-8 text-white/30 text-center">
              <Phone className="opacity-20 mx-auto mb-2 w-8 h-8" />
              <p className="text-sm">No calls yet</p>
              <p className="mt-1 text-xs">Test an agent to see calls here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCalls.map(call => (
                <div key={call.id} className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-colors">
                  <div className="flex flex-shrink-0 justify-center items-center bg-white/10 rounded-full w-7 h-7">
                    <PhoneIncoming className="w-3.5 h-3.5 text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{call.callerName ?? 'Unknown'}</p>
                    <p className="text-white/40 text-xs truncate">{call.agentName}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {call.sentiment && (
                      <span className={cn('block mb-1 text-[10px] badge', sentimentBadge(call.sentiment))}>
                        {call.sentiment}
                      </span>
                    )}
                    <p className="text-[10px] text-white/30">{timeAgo(call.startTime.toISOString())}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}