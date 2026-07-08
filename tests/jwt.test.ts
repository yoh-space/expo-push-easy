import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFcmAccessToken, clearFcmTokenCache, getFcmTokenCacheSize } from '../src/jwt.js'

const sa = {
  project_id: 'test-project',
  client_email: 'test@test.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEA\n-----END PRIVATE KEY-----',
}

beforeEach(() => {
  clearFcmTokenCache()
  vi.restoreAllMocks()
  vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({} as any)
  vi.spyOn(crypto.subtle, 'sign').mockResolvedValue(new ArrayBuffer(16))
})

describe('JWT OAuth Cache', () => {
  it('fetches new token on first call and caches it', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'mock-access-token-123', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', mockFetch)

    expect(getFcmTokenCacheSize()).toBe(0)

    const token1 = await getFcmAccessToken(sa)
    expect(token1).toBe('mock-access-token-123')
    expect(getFcmTokenCacheSize()).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call should return cached token without fetch
    const token2 = await getFcmAccessToken(sa)
    expect(token2).toBe('mock-access-token-123')
    expect(getFcmTokenCacheSize()).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('evicts token from cache on clearFcmTokenCache', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'token', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await getFcmAccessToken(sa)
    expect(getFcmTokenCacheSize()).toBe(1)

    clearFcmTokenCache()
    expect(getFcmTokenCacheSize()).toBe(0)

    // Should fetch again
    await getFcmAccessToken(sa)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
