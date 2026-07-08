import type { TokenRecord } from './types.js';

export function getConvexTableDefinition(defineTable: any, v: any): any {
  return defineTable({
    userId: v.string(),
    token: v.string(),
    platform: v.optional(v.string()), // 'ios' | 'android' | 'web'
    updatedAt: v.number(),
  })
  .index('by_user', ['userId'])
  .index('by_token', ['token']);
}

export const convexTokenHelpers = {
  async saveToken(db: any, userId: string, token: string, platform?: string): Promise<void> {
    const existing = await db
      .query('pushTokens')
      .withIndex('by_token', (q: any) => q.eq('token', token))
      .first();

    if (existing) {
      await db.patch(existing._id, {
        userId,
        platform,
        updatedAt: Date.now(),
      });
    } else {
      await db.insert('pushTokens', {
        userId,
        token,
        platform,
        updatedAt: Date.now(),
      });
    }
  },

  async getTokensForUser(db: any, userId: string): Promise<TokenRecord[]> {
    const records = await db
      .query('pushTokens')
      .withIndex('by_user', (q: any) => q.eq('userId', userId))
      .collect();

    return records.map((r: any) => ({
      userId: r.userId,
      token: r.token,
      platform: r.platform,
      updatedAt: r.updatedAt,
    }));
  },

  async removeToken(db: any, token: string): Promise<void> {
    const existing = await db
      .query('pushTokens')
      .withIndex('by_token', (q: any) => q.eq('token', token))
      .first();

    if (existing) {
      await db.delete(existing._id);
    }
  },

  async updateToken(db: any, oldToken: string, newToken: string): Promise<void> {
    const existing = await db
      .query('pushTokens')
      .withIndex('by_token', (q: any) => q.eq('token', oldToken))
      .first();

    if (existing) {
      await db.patch(existing._id, {
        token: newToken,
        updatedAt: Date.now(),
      });
    }
  }
};
export const CONVEX_PUSH_SCHEMA_INSTRUCTIONS = `
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { getConvexTableDefinition } from "expo-push-easy/adapters";

export default defineSchema({
  pushTokens: getConvexTableDefinition(defineTable, v),
});
`;
