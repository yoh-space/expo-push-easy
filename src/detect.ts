export function detectTokenType(token: string): 'fcm' | 'expo-push' {
  return token.startsWith('ExponentPushToken') ? 'expo-push' : 'fcm'
}
