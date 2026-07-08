import type { PushPayload, PushResult, ServiceAccount } from './types.js'
import { buildFcmPayload } from './payload.js'
import { getFcmAccessToken } from './jwt.js'

export async function sendFcm(
  token: string,
  payload: PushPayload,
  serviceAccount: ServiceAccount,
): Promise<PushResult> {
  try {
    const accessToken = await getFcmAccessToken(serviceAccount)
    const body = buildFcmPayload(token, payload)

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      },
    )

    const text = await res.text()
    if (res.ok) {
      return {
        success: true,
        provider: 'fcm',
        fcmMessageId: JSON.parse(text).name,
        status: res.status,
        token,
      }
    }

    let parsedError: any
    try {
      parsedError = JSON.parse(text)
    } catch {
      // ignore
    }

    const errorCode = parsedError?.error?.status || undefined
    const errorMessage = parsedError?.error?.message || text

    return {
      success: false,
      provider: 'fcm',
      error: errorMessage,
      errorCode,
      status: res.status,
      token,
    }
  } catch (e) {
    return { success: false, provider: 'fcm', error: String(e), token }
  }
}

