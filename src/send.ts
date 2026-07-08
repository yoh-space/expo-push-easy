import type { PushPayload, PushResult, ServiceAccount } from './types.js'
import { detectTokenType } from './detect.js'
import { sendFcm } from './fcm.js'
import { sendExpoPush } from './expo-push.js'

export interface SendOptions {
  serviceAccount?: ServiceAccount | string
  projectId?: string
  throwOnError?: boolean
}

export async function send(
  token: string,
  payload: PushPayload,
  options: SendOptions = {},
): Promise<PushResult> {
  try {
    const type = detectTokenType(token)

    if (type === 'expo-push') {
      return await sendExpoPush(token, payload)
    }

    if (!options.serviceAccount) {
      const msg = 'FCM token detected but no serviceAccount provided. Pass serviceAccount in options.'
      if (options.throwOnError) throw new Error(msg)
      return { success: false, provider: 'fcm', error: msg }
    }

    const sa = typeof options.serviceAccount === 'string'
      ? JSON.parse(options.serviceAccount)
      : options.serviceAccount

    return await sendFcm(token, payload, sa)
  } catch (e) {
    if (options.throwOnError) throw e
    const type = detectTokenType(token)
    return { success: false, provider: type, error: String(e) }
  }
}

export async function sendBatch(
  pushes: { token: string; payload: PushPayload }[],
  options: SendOptions = {},
): Promise<PushResult[]> {
  return Promise.all(pushes.map((p) => send(p.token, p.payload, options)))
}
