import type { TokenStore, TokenRecord } from './types.js';

export function createSupabaseTokenStore(
  supabase: any,
  options?: { table?: string }
): TokenStore {
  const tableName = options?.table || 'user_tokens';

  return {
    async saveToken(userId: string, token: string, platform?: string): Promise<void> {
      const { error } = await supabase
        .from(tableName)
        .upsert({
          user_id: userId,
          token,
          platform: platform || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,token' });

      if (error) throw new Error(`Supabase saveToken failed: ${error.message}`);
    },

    async getTokensForUser(userId: string): Promise<TokenRecord[]> {
      const { data, error } = await supabase
        .from(tableName)
        .select('user_id, token, platform, updated_at')
        .eq('user_id', userId);

      if (error) throw new Error(`Supabase getTokensForUser failed: ${error.message}`);

      return (data || []).map((r: any) => ({
        userId: r.user_id,
        token: r.token,
        platform: r.platform || undefined,
        updatedAt: new Date(r.updated_at).getTime(),
      }));
    },

    async removeToken(token: string): Promise<void> {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('token', token);

      if (error) throw new Error(`Supabase removeToken failed: ${error.message}`);
    },

    async updateToken(oldToken: string, newToken: string): Promise<void> {
      const { error } = await supabase
        .from(tableName)
        .update({
          token: newToken,
          updated_at: new Date().toISOString(),
        })
        .eq('token', oldToken);

      if (error) throw new Error(`Supabase updateToken failed: ${error.message}`);
    }
  };
}

export const SUPABASE_PUSH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS public.user_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT, -- 'ios', 'android', 'web'
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, token)
);

ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own tokens" ON public.user_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tokens" ON public.user_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" ON public.user_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" ON public.user_tokens
  FOR DELETE USING (auth.uid() = user_id);
`;
