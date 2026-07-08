import type { PushPayload } from './types.js'

export function buildFcmPayload(token: string, p: PushPayload): { message: Record<string, unknown> } {
  const message: Record<string, unknown> = {
    token,
    notification: { title: p.title, body: p.body },
  }
  if (p.data) message.data = p.data
  if (p.android) {
    message.android = { priority: p.android.priority || 'HIGH' }
    if (p.android.channelId) {
      ;(message.android as Record<string, unknown>).notification = { channel_id: p.android.channelId }
    }
  }
  return { message }
}

export function buildExpoPushPayload(token: string, p: PushPayload): Record<string, unknown> {
  return {
    to: token,
    title: p.title,
    body: p.body,
    data: p.data || {},
    priority: p.android?.priority?.toLowerCase() || 'high',
    channelId: p.android?.channelId || 'default',
    sound: 'default',
  }
}