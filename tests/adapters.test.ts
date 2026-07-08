import { describe, it, expect, vi } from 'vitest'
import {
  createFirebaseTokenStore,
  createSupabaseTokenStore,
  convexTokenHelpers,
  SUPABASE_PUSH_SCHEMA_SQL,
  CONVEX_PUSH_SCHEMA_INSTRUCTIONS,
} from '../src/adapters/index.js'

describe('Firebase Token Store Adapter', () => {
  it('implements CRUD methods using firestore mock', async () => {
    const docMock = {
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ userId: 'user-1', token: 'token-abc', platform: 'ios', updatedAt: 100 }),
      }),
    }
    const collectionMock = {
      doc: vi.fn().mockReturnValue(docMock),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        forEach: (cb: any) => cb({
          data: () => ({ userId: 'user-1', token: 'token-abc', platform: 'ios', updatedAt: 100 })
        }),
      }),
    }
    const mockFirestore = {
      collection: vi.fn().mockReturnValue(collectionMock),
    }

    const store = createFirebaseTokenStore(mockFirestore)

    // Save token
    await store.saveToken('user-1', 'token-abc', 'ios')
    expect(mockFirestore.collection).toHaveBeenCalledWith('push_tokens')
    expect(collectionMock.doc).toHaveBeenCalledWith('token-abc')
    expect(docMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        token: 'token-abc',
        platform: 'ios',
      }),
      { merge: true }
    )

    // Get tokens
    const tokens = await store.getTokensForUser('user-1')
    expect(tokens).toEqual([{
      userId: 'user-1',
      token: 'token-abc',
      platform: 'ios',
      updatedAt: 100,
    }])

    // Remove token
    await store.removeToken('token-abc')
    expect(docMock.delete).toHaveBeenCalled()

    // Update token
    await store.updateToken('old-token', 'new-token')
    expect(collectionMock.doc).toHaveBeenCalledWith('old-token')
    expect(collectionMock.doc).toHaveBeenCalledWith('new-token')
  })
})

describe('Supabase Token Store Adapter', () => {
  it('implements CRUD methods using supabase mock', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col, val) => {
        if (col === 'user_id' && val === 'user-1') {
          return Promise.resolve({
            data: [{ user_id: 'user-1', token: 'token-abc', platform: 'android', updated_at: '2026-07-08T17:00:00.000Z' }],
            error: null
          });
        }
        return Promise.resolve({ error: null });
      }),
    }

    const store = createSupabaseTokenStore(mockSupabase)

    // Save
    await store.saveToken('user-1', 'token-abc', 'android')
    expect(mockSupabase.from).toHaveBeenCalledWith('user_tokens')
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        token: 'token-abc',
        platform: 'android',
      }),
      { onConflict: 'user_id,token' }
    )

    // Remove
    await store.removeToken('token-abc')
    expect(mockSupabase.delete).toHaveBeenCalled()
    expect(mockSupabase.eq).toHaveBeenCalledWith('token', 'token-abc')

    // Update
    await store.updateToken('old-token', 'new-token')
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ token: 'new-token' }))
    expect(mockSupabase.eq).toHaveBeenCalledWith('token', 'old-token')

    // Verify sql string export
    expect(SUPABASE_PUSH_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS public.user_tokens')
  })
})

describe('Convex Token Helpers Adapter', () => {
  it('implements convexTokenHelpers operations', async () => {
    const mockDb = {
      query: vi.fn().mockReturnThis(),
      withIndex: vi.fn().mockReturnThis(),
      first: vi.fn(),
      collect: vi.fn(),
      patch: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockResolvedValue('id-123'),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    // Save - Insert new
    mockDb.first.mockResolvedValue(null)
    await convexTokenHelpers.saveToken(mockDb, 'user-1', 'token-abc', 'web')
    expect(mockDb.insert).toHaveBeenCalledWith('pushTokens', expect.objectContaining({
      userId: 'user-1',
      token: 'token-abc',
      platform: 'web',
    }))

    // Save - Update existing
    mockDb.first.mockResolvedValue({ _id: 'doc-123', userId: 'user-1', token: 'token-abc' })
    await convexTokenHelpers.saveToken(mockDb, 'user-1', 'token-abc', 'web')
    expect(mockDb.patch).toHaveBeenCalledWith('doc-123', expect.objectContaining({
      userId: 'user-1',
      platform: 'web',
    }))

    // Get tokens
    mockDb.collect.mockResolvedValue([
      { userId: 'user-1', token: 't1', platform: 'ios', updatedAt: 123 }
    ])
    const tokens = await convexTokenHelpers.getTokensForUser(mockDb, 'user-1')
    expect(tokens).toEqual([{
      userId: 'user-1',
      token: 't1',
      platform: 'ios',
      updatedAt: 123,
    }])

    // Remove
    mockDb.first.mockResolvedValue({ _id: 'doc-123' })
    await convexTokenHelpers.removeToken(mockDb, 'token-abc')
    expect(mockDb.delete).toHaveBeenCalledWith('doc-123')

    // Update
    mockDb.first.mockResolvedValue({ _id: 'doc-123' })
    await convexTokenHelpers.updateToken(mockDb, 'old', 'new')
    expect(mockDb.patch).toHaveBeenCalledWith('doc-123', expect.objectContaining({ token: 'new' }))

    expect(CONVEX_PUSH_SCHEMA_INSTRUCTIONS).toContain('getConvexTableDefinition')
  })
})
