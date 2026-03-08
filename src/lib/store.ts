// FILE: src/lib/store.ts
import { create } from 'zustand'
import type { TranscriptEntry } from './groq'

interface ActiveCall {
  callId: string
  roomName: string
  agentId: string
  agentName: string
  token: string
  startTime: string
  transcript: TranscriptEntry[]
  isMuted: boolean
  status: 'connecting' | 'active' | 'ending'
}

interface Store {
  activeCall: ActiveCall | null
  setActiveCall: (c: ActiveCall | null) => void
  addTranscript: (e: TranscriptEntry) => void
  setMuted: (m: boolean) => void
  setCallStatus: (s: ActiveCall['status']) => void
}

export const useStore = create<Store>((set) => ({
  activeCall: null,
  setActiveCall: (activeCall) => set({ activeCall }),
  addTranscript: (entry) => set(s => s.activeCall
    ? { activeCall: { ...s.activeCall, transcript: [...s.activeCall.transcript, entry] } }
    : {}),
  setMuted: (isMuted) => set(s => s.activeCall ? { activeCall: { ...s.activeCall, isMuted } } : {}),
  setCallStatus: (status) => set(s => s.activeCall ? { activeCall: { ...s.activeCall, status } } : {}),
}))