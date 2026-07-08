import type { PushPayload, PushResult } from './types.js'
import { buildExpoPushPayload } from './payload.js'

export async function sendExpoPush(
  token: string,
  payload: PushPayload,
  expoAccessToken?: string,
): Promise<PushResult> {
  try {
    const body = buildExpoPushPayload(token, payload)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (expoAccessToken) {
      headers['Authorization'] = `Bearer ${expoAccessToken}`
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const result = await res.json()
    const ticket = result?.data?.[0]
    const success = res.ok && (ticket ? ticket.status === 'ok' : true)

    let errorMsg: string | undefined = undefined
    let errorCode: string | undefined = undefined

    if (!success) {
      if (ticket?.status === 'error') {
        errorMsg = ticket.message
        errorCode = ticket.details?.error
      } else {
        errorMsg = result?.message || result?.errors?.[0]?.message || 'Unknown Expo Push Error'
        errorCode = result?.errors?.[0]?.code
      }
    }

    return {
      success,
      provider: 'expo-push',
      status: res.status,
      error: errorMsg,
      errorCode,
      expoPushTicketId: ticket?.id,
      token,
    }
  } catch (e) {
    return { success: false, provider: 'expo-push', error: String(e), token }
  }
}

