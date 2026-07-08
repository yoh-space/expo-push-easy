import type { PushPayload, PushResult } from './types.js'
import { buildExpoPushPayload } from './payload.js'

export async function sendExpoPush(
  token: string,
  payload: PushPayload,
): Promise<PushResult> {
  try {
    const body = buildExpoPushPayload(token, payload)

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const result = await res.json()
    return {
      success: res.ok,
      provider: 'expo-push',
      status: res.status,
      error: result?.message,
    }
  } catch (e) {
    return { success: false, provider: 'expo-push', error: String(e) }
  }
}
