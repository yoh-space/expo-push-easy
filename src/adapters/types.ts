export interface TokenRecord {
  userId: string;
  token: string;
  platform?: 'ios' | 'android' | 'web';
  updatedAt: number; // ms timestamp
}

export interface TokenStore {
  saveToken(userId: string, token: string, platform?: string): Promise<void>;
  getTokensForUser(userId: string): Promise<TokenRecord[]>;
  removeToken(token: string): Promise<void>;
  updateToken(oldToken: string, newToken: string): Promise<void>;
}
