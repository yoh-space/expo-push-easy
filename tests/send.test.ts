import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectTokenType } from '../src/detect.js'
import { buildFcmPayload, buildExpoPushPayload } from '../src/payload.js'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('detectTokenType', () => {
  it('detects FCM token', () => {
    expect(detectTokenType('fMcA6s8Abx0:APA91bHZnc')).toBe('fcm')
  })

  it('detects Expo Push token', () => {
    expect(detectTokenType('ExponentPushToken[xxxxxxx]')).toBe('expo-push')
  })

  it('detects short FCM token', () => {
    expect(detectTokenType('doWWqvnFRBWYgKbv5CQteI')).toBe('fcm')
  })
})

describe('buildFcmPayload', () => {
  it('builds basic payload with notification', () => {
    const result = buildFcmPayload('token123', {
      title: 'Hello',
      body: 'World',
    })
    expect(result.message).toEqual({
      token: 'token123',
      notification: { title: 'Hello', body: 'World' },
    })
  })

  it('includes data when provided', () => {
    const result = buildFcmPayload('token123', {
      title: 'Hi',
      body: 'Test',
      data: { screen: '/orders', orderId: '42' },
    })
    expect(result.message.data).toEqual({ screen: '/orders', orderId: '42' })
  })

  it('uses snake_case channel_id in android block', () => {
    const result = buildFcmPayload('token123', {
      title: 'Hi',
      body: 'Test',
      android: { channelId: 'orders', priority: 'HIGH' },
    })
    expect(result.message.android).toEqual({
      priority: 'HIGH',
      notification: { channel_id: 'orders' },
    })
  })

  it('defaults to HIGH priority when not set', () => {
    const result = buildFcmPayload('token123', {
      title: 'Hi',
      body: 'Test',
      android: { channelId: 'default' },
    })
    expect(result.message.android).toEqual({
      priority: 'HIGH',
      notification: { channel_id: 'default' },
    })
  })

  it('does not add android block when no android config', () => {
    const result = buildFcmPayload('token123', {
      title: 'Hi',
      body: 'Test',
    })
    expect(result.message.android).toBeUndefined()
  })
})

describe('buildExpoPushPayload', () => {
  it('builds basic Expo payload', () => {
    const result = buildExpoPushPayload('ExponentPushToken[abc]', {
      title: 'Hello',
      body: 'World',
    })
    expect(result).toEqual({
      to: 'ExponentPushToken[abc]',
      title: 'Hello',
      body: 'World',
      data: {},
      priority: 'high',
      channelId: 'default',
      sound: 'default',
    })
  })

  it('includes data and android config', () => {
    const result = buildExpoPushPayload('ExponentPushToken[abc]', {
      title: 'Hi',
      body: 'Test',
      data: { key: 'value' },
      android: { channelId: 'custom', priority: 'NORMAL' },
    })
    expect(result.data).toEqual({ key: 'value' })
    expect(result.channelId).toBe('custom')
    expect(result.priority).toBe('normal')
  })
})

describe('sendExpoPush', () => {
  it('returns success on 200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendExpoPush } = await import('../src/expo-push.js')
    const result = await sendExpoPush('ExponentPushToken[abc]', {
      title: 'Test',
      body: 'Body',
    })

    expect(result.success).toBe(true)
    expect(result.provider).toBe('expo-push')
    expect(result.status).toBe(200)
  })

  it('returns error on failed response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid token' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendExpoPush } = await import('../src/expo-push.js')
    const result = await sendExpoPush('ExponentPushToken[bad]', {
      title: 'Test',
      body: 'Body',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid token')
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { sendExpoPush } = await import('../src/expo-push.js')
    const result = await sendExpoPush('ExponentPushToken[abc]', {
      title: 'Test',
      body: 'Body',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network error')
  })
})

describe('send', () => {
  it('routes Expo tokens to Expo push', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { send } = await import('../src/send.js')
    const result = await send('ExponentPushToken[abc]', {
      title: 'Test',
      body: 'Body',
    })

    expect(result.success).toBe(true)
    expect(result.provider).toBe('expo-push')
    expect(mockFetch.mock.calls[0][0]).toBe('https://exp.host/--/api/v2/push/send')
  })

  it('routes FCM tokens to FCM when serviceAccount is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: 'projects/test/messages/123' }),
      text: async () => JSON.stringify({ name: 'projects/test/messages/123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const sa = {
      project_id: 'test-project',
      client_email: 'test@test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEA\n-----END PRIVATE KEY-----',
    }

    const { send } = await import('../src/send.js')
    const result = await send('fcm-token-123', {
      title: 'Test',
      body: 'Body',
    }, { serviceAccount: sa })

    expect(result.provider).toBe('fcm')
  })

  it('returns error for FCM token without serviceAccount', async () => {
    const { send } = await import('../src/send.js')
    const result = await send('fcm-token-123', {
      title: 'Test',
      body: 'Body',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('no serviceAccount provided')
  })

  it('throws when throwOnError is set', async () => {
    const { send } = await import('../src/send.js')
    await expect(
      send('fcm-token', { title: 'T', body: 'B' }, { throwOnError: true }),
    ).rejects.toThrow()
  })
})

describe('sendBatch', () => {
  it('sends to multiple tokens', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendBatch } = await import('../src/send.js')
    const results = await sendBatch([
      { token: 'ExponentPushToken[a]', payload: { title: 'A', body: 'Body' } },
      { token: 'ExponentPushToken[b]', payload: { title: 'B', body: 'Body' } },
    ])

    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
