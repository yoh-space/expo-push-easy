import { describe, it, expect, vi } from 'vitest'
import {
  createScheduledPush,
  processScheduledPushes,
  InMemoryScheduleStore,
} from '../src/scheduling/index.js'

describe('Server-Side Scheduling', () => {
  it('creates scheduled push objects', () => {
    const date = new Date()
    const job = createScheduledPush('token-123', { title: 'T', body: 'B' }, date, { throwOnError: true })

    expect(job.id).toBeDefined()
    expect(job.token).toBe('token-123')
    expect(job.payload).toEqual({ title: 'T', body: 'B' })
    expect(job.sendAt).toBe(date.getTime())
    expect(job.status).toBe('pending')
    expect(job.options).toEqual({ throwOnError: true })
  })

  it('runs InMemoryScheduleStore CRUD operations', async () => {
    const store = new InMemoryScheduleStore()
    const job1 = createScheduledPush('t1', { title: 'T1', body: 'B1' }, Date.now() - 1000)
    const job2 = createScheduledPush('t2', { title: 'T2', body: 'B2' }, Date.now() + 5000)

    await store.save(job1)
    await store.save(job2)

    const pending = await store.getPending(Date.now())
    // Should only collect job1 (due now), job2 is scheduled in the future
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(job1.id)

    // Mark job1 as sent
    await store.markSent(job1.id, { sentAt: Date.now() })
    const updatedJob1 = await store.getJob(job1.id)
    expect(updatedJob1?.status).toBe('sent')
    expect(updatedJob1?.sentAt).toBeDefined()
    expect(updatedJob1?.error).toBeUndefined()

    // Cancel job2
    await store.cancel(job2.id)
    const updatedJob2 = await store.getJob(job2.id)
    expect(updatedJob2?.status).toBe('cancelled')
  })

  it('processes scheduled pushes successfully using custom sendFn', async () => {
    const store = new InMemoryScheduleStore()
    const job = createScheduledPush('t1', { title: 'T1', body: 'B1' }, Date.now() - 1000)
    await store.save(job)

    const mockSend = vi.fn().mockResolvedValue({
      success: true,
      provider: 'fcm',
      status: 200,
      fcmMessageId: 'msg-id',
    })

    const results = await processScheduledPushes(store, mockSend)

    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(mockSend).toHaveBeenCalledWith('t1', { title: 'T1', body: 'B1' }, undefined)

    // Verify job updated in store
    const updatedJob = await store.getJob(job.id)
    expect(updatedJob?.status).toBe('sent')
    expect(updatedJob?.sentAt).toBeDefined()
    expect(updatedJob?.error).toBeUndefined()
  })

  it('marks jobs as failed when sendFn throws or returns unsuccessful result', async () => {
    const store = new InMemoryScheduleStore()
    const job1 = createScheduledPush('t1', { title: 'T1', body: 'B1' }, Date.now() - 500)
    const job2 = createScheduledPush('t2', { title: 'T2', body: 'B2' }, Date.now() - 500)
    await store.save(job1)
    await store.save(job2)

    const mockSend = vi.fn()
      // First call throws
      .mockRejectedValueOnce(new Error('Network Down'))
      // Second call returns error result
      .mockResolvedValueOnce({
        success: false,
        provider: 'fcm',
        status: 400,
        error: 'Invalid Registration Token',
      })

    const results = await processScheduledPushes(store, mockSend)

    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toContain('Network Down')
    expect(results[1].success).toBe(false)
    expect(results[1].error).toBe('Invalid Registration Token')

    const updatedJob1 = await store.getJob(job1.id)
    expect(updatedJob1?.status).toBe('failed')
    expect(updatedJob1?.error).toContain('Network Down')

    const updatedJob2 = await store.getJob(job2.id)
    expect(updatedJob2?.status).toBe('failed')
    expect(updatedJob2?.error).toBe('Invalid Registration Token')
  })
})
