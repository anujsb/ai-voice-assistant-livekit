'use client'
// FILE: src/components/call/CallModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, PhoneOff, X, Loader2, Bot, User,
  Mic, MicOff, CheckCircle2, AlertCircle,
} from 'lucide-react'
import {
  LiveKitRoom,
  useRoomContext,
  useConnectionState,
  useLocalParticipant,
  RoomAudioRenderer,
} from '@livekit/components-react'
import { ConnectionState, RoomEvent, DisconnectReason } from 'livekit-client'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'

interface Entry { id: string; role: 'agent' | 'user'; content: string }

// ─── Transcript bubbles ────────────────────────────────────────────────────────
function Bubble({ e, agentName }: { e: Entry; agentName: string }) {
  return (
    <div className={cn('flex gap-2', e.role === 'user' && 'flex-row-reverse')}>
      <div className={cn(
        'flex flex-shrink-0 justify-center items-center mt-0.5 rounded-full w-6 h-6',
        e.role === 'agent' ? 'bg-green-500/20' : 'bg-white/10'
      )}>
        {e.role === 'agent'
          ? <Bot className="w-3 h-3 text-green-400" />
          : <User className="w-3 h-3 text-white/50" />}
      </div>
      <div className={cn(
        'px-3 py-2 rounded-2xl max-w-[80%] text-sm leading-relaxed',
        e.role === 'agent'
          ? 'bg-green-500/10 border border-green-500/20 text-white rounded-tl-sm'
          : 'bg-white/10 border border-white/10 text-white/80 rounded-tr-sm'
      )}>
        {e.content}
      </div>
    </div>
  )
}

// ─── Inner room component (must be inside <LiveKitRoom>) ──────────────────────
function RoomInner({
  agentName,
  greeting,
  onEnd,
  onTranscript,
}: {
  agentName: string
  greeting: string
  onEnd: (entries: Entry[]) => void
  onTranscript: (e: Entry) => void
}) {
  const room = useRoomContext()
  const connState = useConnectionState()
  const { localParticipant } = useLocalParticipant()
  const [muted, setMuted] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [agentSpeaking, setAgentSpeaking] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const greetingShown = useRef(false)
  const entriesRef = useRef<Entry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const add = useCallback((role: 'agent' | 'user', content: string) => {
    const entry: Entry = { id: nanoid(), role, content }
    setEntries(p => { const next = [...p, entry]; entriesRef.current = next; return next })
    onTranscript(entry)
  }, [onTranscript])

  // Show greeting once connected
  useEffect(() => {
    if (connState === ConnectionState.Connected && !greetingShown.current) {
      greetingShown.current = true
      setTimeout(() => add('agent', greeting), 500)
    }
  }, [connState, greeting, add])

  // Timer
  useEffect(() => {
    if (connState !== ConnectionState.Connected) return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [connState])

  // Scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [entries])

  // Listen for transcript data from Python agent
  useEffect(() => {
    if (!room) return
    const handler = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload))
        if (msg.type === 'transcript' && msg.content) {
          add(msg.role as 'agent' | 'user', msg.content)
        }
        if (msg.type === 'agent_speaking') {
          setAgentSpeaking(!!msg.value)
        }
      } catch {}
    }
    room.on(RoomEvent.DataReceived, handler)
    return () => { room.off(RoomEvent.DataReceived, handler) }
  }, [room, add])

  const toggleMute = async () => {
    const next = !muted
    setMuted(next)
    await localParticipant?.setMicrophoneEnabled(!next)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <>
      {/* This renders all remote audio — the agent's voice comes through here */}
      <RoomAudioRenderer />

      <div className="flex flex-col" style={{ height: 460 }}>
        {/* Status */}
        <div className="flex justify-between items-center bg-black/20 px-4 py-2 border-white/5 border-b">
          <div className="flex items-center gap-2">
            {connState === ConnectionState.Connecting && (
              <><Loader2 className="w-3 h-3 text-white/40 animate-spin" /><span className="text-white/40 text-xs">Connecting…</span></>
            )}
            {connState === ConnectionState.Connected && (
              <>
                <div className={cn('rounded-full w-1.5 h-1.5', agentSpeaking ? 'bg-green-400 animate-pulse' : 'bg-green-500')} />
                <span className="text-green-400 text-xs">
                  {agentSpeaking ? `${agentName} is speaking…` : `Live · ${fmt(elapsed)}`}
                </span>
              </>
            )}
          </div>
          {/* Waveform indicator */}
          {connState === ConnectionState.Connected && (
            <div className={cn('flex items-end gap-0.5 h-4', !agentSpeaking && 'opacity-20')}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="wave-bar" style={{ animationPlayState: agentSpeaking ? 'running' : 'paused', height: '16px' }} />
              ))}
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 space-y-3 px-4 py-3 min-h-0 overflow-y-auto">
          {entries.length === 0 && connState === ConnectionState.Connected && (
            <div className="flex flex-col justify-center items-center gap-2 h-full text-white/20">
              <Bot className="w-8 h-8" />
              <p className="text-sm">Waiting for agent…</p>
              <p className="opacity-60 text-xs">Make sure Python agent is running</p>
            </div>
          )}
          {entries.map(e => <Bubble key={e.id} e={e} agentName={agentName} />)}
          <div ref={bottomRef} />
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center p-4 border-white/10 border-t">
          <button
            onClick={toggleMute}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium text-sm transition-all',
              muted
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            )}>
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>

          <button
            onClick={() => onEnd(entriesRef.current)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-400 px-4 py-2.5 rounded-xl font-medium text-white text-sm active:scale-95 transition-all">
            <PhoneOff className="w-4 h-4" />
            End Call
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface Props { agentId: string; agentName: string; greeting: string; onClose: () => void }

export default function CallModal({ agentId, agentName, greeting, onClose }: Props) {
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'active' | 'ending' | 'ended'>('idle')
  const [token, setToken] = useState<string>('')
  const [roomName, setRoomName] = useState<string>('')
  const [callId, setCallId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [endedEntries, setEndedEntries] = useState<Entry[]>([])
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number>(0)

  const start = async () => {
    setError(null)
    setPhase('connecting')
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, callerName: 'Demo Caller' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start call')
      setToken(data.token)
      setRoomName(data.roomName)
      setCallId(data.callId)
      startTimeRef.current = Date.now()
      setPhase('active')
    } catch (e: any) {
      setError(e.message)
      setPhase('idle')
    }
  }

  const handleEnd = async (entries: Entry[]) => {
    setEndedEntries(entries)
    setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000))
    setPhase('ending')
    // Run AI analysis
    if (callId && entries.length > 1) {
      await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'analyze', transcript: entries, roomName }),
      }).catch(() => {})
    }
    setTimeout(() => setPhase('ended'), 800)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
        onClick={e => { if (e.target === e.currentTarget && (phase === 'idle' || phase === 'ended')) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="bg-zinc-900 shadow-2xl border border-white/10 sm:rounded-3xl rounded-t-3xl w-full sm:max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-white/10 border-b">
            <div className={cn(
              'relative flex justify-center items-center rounded-2xl w-10 h-10',
              phase === 'active' ? 'bg-green-500/15' : 'bg-white/5'
            )}>
              <Bot className={cn('w-5 h-5', phase === 'active' ? 'text-green-400' : 'text-white/40')} />
              {phase === 'active' && <span className="absolute inset-0 rounded-2xl ring-pulse" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{agentName}</p>
              <p className="text-white/40 text-xs">
                {phase === 'idle'       && 'Ready — Python agent must be running'}
                {phase === 'connecting' && 'Setting up room…'}
                {phase === 'active'     && 'Live call via LiveKit + Groq'}
                {phase === 'ending'     && 'Saving transcript…'}
                {phase === 'ended'      && 'Call ended'}
              </p>
            </div>
            {(phase === 'idle' || phase === 'ended') && (
              <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* IDLE */}
          {phase === 'idle' && (
            <div className="flex flex-col items-center gap-4 p-6">
              <div className="flex justify-center items-center bg-green-500/10 border border-green-500/20 rounded-full w-16 h-16">
                <Phone className="w-7 h-7 text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-white">Call {agentName}</p>
                <p className="mt-1 text-white/40 text-xs">Real voice via LiveKit · Groq PlayAI TTS</p>
              </div>
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 p-3 border border-red-500/20 rounded-xl w-full text-red-400 text-xs">
                  <AlertCircle className="flex-shrink-0 mt-0.5 w-4 h-4" />
                  <p>{error}</p>
                </div>
              )}
              {/* Checklist */}
              <div className="space-y-2 bg-white/5 p-3 border border-white/10 rounded-xl w-full">
                <p className="mb-2 text-[10px] text-white/30 uppercase tracking-wider">Before calling</p>
                {[
                  'Python agent is running (python3 main.py dev)',
                  'Microphone permission allowed in browser',
                  'LIVEKIT_API_KEY and GROQ_API_KEY set in .env.local',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-white/50 text-xs">
                    <div className="flex flex-shrink-0 justify-center items-center mt-0.5 border border-white/20 rounded-full w-4 h-4">
                      <span className="text-[9px]">{i + 1}</span>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
              <button onClick={start} className="py-3 w-full text-base btn-primary">
                <Phone className="w-4 h-4" /> Start Call
              </button>
            </div>
          )}

          {/* CONNECTING */}
          {phase === 'connecting' && (
            <div className="flex flex-col items-center gap-3 p-12">
              <Loader2 className="w-7 h-7 text-green-400 animate-spin" />
              <p className="text-white/40 text-sm">Creating LiveKit room…</p>
            </div>
          )}

          {/* ACTIVE — LiveKit handles audio, RoomAudioRenderer plays agent voice */}
          {phase === 'active' && token && (
            <LiveKitRoom
              token={token}
              serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
              audio={true}
              video={false}
              connect={true}
              onDisconnected={() => handleEnd([])}
              options={{ adaptiveStream: true, dynacast: true }}
            >
              <RoomInner
                agentName={agentName}
                greeting={greeting}
                onEnd={handleEnd}
                onTranscript={() => {}}
              />
            </LiveKitRoom>
          )}

          {/* ENDING */}
          {phase === 'ending' && (
            <div className="flex flex-col items-center gap-3 p-10">
              <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
              <p className="text-white/40 text-sm">Running AI analysis…</p>
            </div>
          )}

          {/* ENDED */}
          {phase === 'ended' && (
            <div className="flex flex-col items-center gap-4 p-6">
              <div className="flex justify-center items-center bg-green-500/10 border border-green-500/20 rounded-full w-12 h-12">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-white">Call Complete</p>
                <p className="mt-1 text-white/40 text-xs">{fmt(elapsed)} · Transcript saved · AI analysis done</p>
              </div>
              {endedEntries.length > 0 && (
                <div className="space-y-1.5 bg-black/30 p-3 border border-white/10 rounded-xl w-full max-h-44 overflow-y-auto">
                  {endedEntries.map(e => (
                    <div key={e.id} className={cn('p-2 rounded-lg text-xs',
                      e.role === 'agent' ? 'bg-green-500/10 text-green-300' : 'bg-white/5 text-white/50')}>
                      <span className="mr-1 font-semibold">{e.role === 'agent' ? agentName : 'You'}:</span>{e.content}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 w-full">
                <button onClick={() => { setPhase('idle'); setEndedEntries([]) }} className="flex-1 btn-secondary">Call Again</button>
                <button onClick={onClose} className="flex-1 btn-primary">Done</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}