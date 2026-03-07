// FILE: src/app/api/livekit/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import { getCallByRoom, updateCallByRoom, getAgent } from '@/lib/db/queries'
import { analyzeCall } from '@/lib/groq'
import { deliverWebhook } from '@/lib/db/queries'
import type { TranscriptEntry } from '@/lib/groq'

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const authHeader = req.headers.get('Authorization') ?? ''

  try {
    const event = await receiver.receive(body, authHeader)
    const roomName = event.room?.name ?? ''

    console.log('[webhook]', event.event, roomName)

    switch (event.event) {
      case 'room_started': {
        await updateCallByRoom(roomName, { status: 'active', startTime: new Date() })
        break
      }

      case 'room_finished': {
        const call = await getCallByRoom(roomName)
        if (!call) break

        const endTime = new Date()
        const duration = Math.round((endTime.getTime() - new Date(call.startTime).getTime()) / 1000)
        const transcript = (call.transcript ?? []) as TranscriptEntry[]

        // Run AI analysis on transcript
        let analysis = { summary: '', sentiment: 'neutral' as any, intent: '', resolved: false, keyPoints: [] as string[] }
        if (transcript.length > 0) {
          try { analysis = await analyzeCall(transcript) } catch (e) { console.error('[analysis]', e) }
        }

        const updated = await updateCallByRoom(roomName, {
          status: 'completed',
          endTime,
          durationSeconds: duration,
          summary: analysis.summary || null,
          sentiment: analysis.sentiment || null,
          resolvedWithoutEscalation: analysis.resolved,
        })

        // Fire webhook if agent has one configured
        if (updated?.agentId) {
          const agent = await getAgent(updated.agentId)
          if (agent?.webhookUrl) {
            await deliverWebhook(agent.id, updated.id, 'call.completed', agent.webhookUrl, {
              callId:      updated.id,
              agentId:     agent.id,
              agentName:   agent.name,
              callerName:  updated.callerName,
              callerPhone: updated.callerPhone,
              duration,
              summary:     analysis.summary,
              sentiment:   analysis.sentiment,
              resolved:    analysis.resolved,
              transcript,
              endTime:     endTime.toISOString(),
            })
          }
        }
        break
      }

      case 'participant_joined': {
        const identity = event.participant?.identity ?? ''
        if (identity.startsWith('caller-')) {
          await updateCallByRoom(roomName, { status: 'active' })
        }
        break
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[webhook error]', err)
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 401 })
  }
}