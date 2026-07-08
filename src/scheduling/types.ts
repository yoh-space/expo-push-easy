import type { PushPayload } from '../types.js';
import type { SendOptions } from '../send.js';

export interface ScheduledPush {
  id: string;
  token: string;
  payload: PushPayload;
  options?: SendOptions;
  sendAt: number;            // Unix timestamp ms
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdAt: number;
  sentAt?: number;
  error?: string;
}

export interface ScheduleStore {
  save(job: ScheduledPush): Promise<void>;
  getPending(before: number): Promise<ScheduledPush[]>;
  markSent(id: string, result: { sentAt: number; error?: string }): Promise<void>;
  cancel(id: string): Promise<void>;
}
