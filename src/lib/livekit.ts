// FILE: src/lib/livekit.ts
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { nanoid } from 'nanoid'

const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY!
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!
const LIVEKIT_URL        = process.env.NEXT_PUBLIC_LIVEKIT_URL!

export function getLivekitClient() {
  const host = LIVEKIT_URL.replace('wss://', 'https://')
  return new RoomServiceClient(host, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
}

export async function createToken(opts: {
  roomName: string
  identity: string
  name: string
  canPublish?: boolean
  canSubscribe?: boolean
  metadata?: string
  ttl?: number
}): Promise<string> {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.name,
    ttl: opts.ttl ?? 3600,
    metadata: opts.metadata,
  })
  at.addGrant({
    roomJoin: true,
    room: opts.roomName,
    canPublish: opts.canPublish ?? true,
    canSubscribe: opts.canSubscribe ?? true,
    canPublishData: true,
  })
  return at.toJwt()
}

export function generateRoomName(agentId: string) {
  return `vocalhq-${agentId.slice(0, 8)}-${nanoid(8)}`
}

export async function createCallerToken(roomName: string, callerName: string) {
  return createToken({
    roomName,
    identity: `caller-${nanoid(6)}`,
    name: callerName || 'Caller',
    ttl: 1800,
    metadata: JSON.stringify({ role: 'caller' }),
  })
}

export async function createAgentToken(roomName: string, agentId: string) {
  return createToken({
    roomName,
    identity: `agent-${agentId.slice(0, 8)}`,
    name: 'AI Receptionist',
    ttl: 3600,
    metadata: JSON.stringify({ role: 'agent', agentId }),
  })
}

export async function createObserverToken(roomName: string) {
  return createToken({
    roomName,
    identity: `observer-${nanoid(6)}`,
    name: 'Dashboard',
    canPublish: false,
    canSubscribe: true,
    ttl: 3600,
    metadata: JSON.stringify({ role: 'observer' }),
  })
}