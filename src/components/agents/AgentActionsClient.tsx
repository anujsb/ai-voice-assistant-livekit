'use client'
// FILE: src/components/agents/AgentActionsClient.tsx
import { useState } from 'react'
import { Phone, Pause, Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import CallModal from '@/components/call/CallModal'
import { useRouter } from 'next/navigation'

interface Props {
  agentId: string
  agentName: string
  agentGreeting: string
  currentStatus: string
}

export default function AgentActionsClient({ agentId, agentName, agentGreeting, currentStatus }: Props) {
  const [showCall, setShowCall] = useState(false)
  const [toggling, setToggling] = useState(false)
  const router = useRouter()

  const toggleStatus = async () => {
    setToggling(true)
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    await fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setToggling(false)
  }

  return (
    <>
      <button onClick={() => setShowCall(true)} className="flex-1 justify-center py-2 text-xs btn-primary">
        <Phone className="w-3.5 h-3.5" />
        Test Call
      </button>

      <button
        onClick={toggleStatus}
        disabled={toggling}
        className={cn(
          'px-3 py-2 border rounded-xl text-xs transition-all',
          currentStatus === 'active'
            ? 'bg-white/5 border-white/10 text-white/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
            : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
        )}>
        {toggling
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : currentStatus === 'active'
            ? <Pause className="w-3.5 h-3.5" />
            : <Play className="w-3.5 h-3.5" />}
      </button>

      {showCall && (
        <CallModal
          agentId={agentId}
          agentName={agentName}
          greeting={agentGreeting}
          onClose={() => setShowCall(false)}
        />
      )}
    </>
  )
}