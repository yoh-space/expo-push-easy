import type { PushPayload, PushResult } from '../types.js';
import type { SendOptions } from '../send.js';
import { send } from '../send.js';
import type { ScheduledPush, ScheduleStore } from './types.js';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createScheduledPush(
  token: string,
  payload: PushPayload,
  sendAt: number | Date,
  options?: SendOptions
): ScheduledPush {
  const sendAtMs = sendAt instanceof Date ? sendAt.getTime() : sendAt;
  return {
    id: generateId(),
    token,
    payload,
    options,
    sendAt: sendAtMs,
    status: 'pending',
    createdAt: Date.now(),
  };
}

export async function processScheduledPushes(
  store: ScheduleStore,
  sendFn: (token: string, payload: PushPayload, options?: SendOptions) => Promise<PushResult> = send
): Promise<PushResult[]> {
  const now = Date.now();
  const pending = await store.getPending(now);
  
  const results = await Promise.all(
    pending.map(async (job) => {
      try {
        const result = await sendFn(job.token, job.payload, job.options);
        await store.markSent(job.id, {
          sentAt: Date.now(),
          error: result.success ? undefined : result.error,
        });
        return result;
      } catch (e) {
        const errorMsg = String(e);
        await store.markSent(job.id, {
          sentAt: Date.now(),
          error: errorMsg,
        });
        return {
          success: false,
          provider: job.token.startsWith('ExponentPushToken') ? 'expo-push' : 'fcm' as 'expo-push' | 'fcm',
          error: errorMsg,
          token: job.token,
        };
      }
    })
  );

  return results;
}

export class InMemoryScheduleStore implements ScheduleStore {
  private jobs = new Map<string, ScheduledPush>();

  async save(job: ScheduledPush): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async getPending(before: number): Promise<ScheduledPush[]> {
    const pending: ScheduledPush[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' && job.sendAt <= before) {
        pending.push({ ...job });
      }
    }
    return pending;
  }

  async markSent(id: string, result: { sentAt: number; error?: string }): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.status = result.error ? 'failed' : 'sent';
      job.sentAt = result.sentAt;
      job.error = result.error;
      this.jobs.set(id, job);
    }
  }

  async cancel(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'cancelled';
      this.jobs.set(id, job);
    }
  }

  // Helper for tests/inspecting
  async getJob(id: string): Promise<ScheduledPush | undefined> {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }
}
