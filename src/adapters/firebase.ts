import type { TokenStore, TokenRecord } from './types.js';

export function createFirebaseTokenStore(
  firestore: any,
  options?: { collection?: string }
): TokenStore {
  const collectionName = options?.collection || 'push_tokens';

  return {
    async saveToken(userId: string, token: string, platform?: string): Promise<void> {
      await firestore
        .collection(collectionName)
        .doc(token)
        .set({
          userId,
          token,
          platform: platform || null,
          updatedAt: Date.now(),
        }, { merge: true });
    },

    async getTokensForUser(userId: string): Promise<TokenRecord[]> {
      const snapshot = await firestore
        .collection(collectionName)
        .where('userId', '==', userId)
        .get();

      const records: TokenRecord[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        records.push({
          userId: data.userId,
          token: data.token,
          platform: data.platform || undefined,
          updatedAt: data.updatedAt,
        });
      });
      return records;
    },

    async removeToken(token: string): Promise<void> {
      await firestore
        .collection(collectionName)
        .doc(token)
        .delete();
    },

    async updateToken(oldToken: string, newToken: string): Promise<void> {
      const oldDocRef = firestore.collection(collectionName).doc(oldToken);
      const doc = await oldDocRef.get();
      
      const exists = typeof doc.exists === 'function' ? doc.exists() : doc.exists;
      if (exists) {
        const data = doc.data();
        // Create new doc first, then delete old
        await firestore.collection(collectionName).doc(newToken).set({
          ...data,
          token: newToken,
          updatedAt: Date.now(),
        });
        await oldDocRef.delete();
      }
    }
  };
}
