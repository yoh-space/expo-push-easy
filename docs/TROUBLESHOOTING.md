# Troubleshooting Guide

This guide covers common issues when using `expo-push-easy` and their solutions.

## Table of Contents

- [Token Registration Issues](#token-registration-issues)
- [Notification Not Received](#notification-not-received)
- [Environment & Configuration](#environment--configuration)
- [FCM Specific Issues](#fcm-specific-issues)
- [Expo Push Specific Issues](#expo-push-specific-issues)
- [Client-Side Errors](#client-side-errors)
- [Server-Side Errors](#server-side-errors)
- [Testing & Debugging](#testing--debugging)

---

## Token Registration Issues

### Error: "No 'projectId' found"

**Symptom:**
```
Error: No "projectId" found. If "projectId" can't be inferred from the manifest 
(for instance, in bare workflow), you have to pass it in yourself.
```

**Cause:** 
- Using default token registration without a project ID
- Missing EAS project configuration

**Solution 1: Use Device Push Tokens (Recommended for FCM)**
```typescript
// For FCM tokens, use device push tokens
const result = await registerForPushNotifications({ 
  useDevicePushToken: true 
});
```

**Solution 2: Provide Project ID**
```typescript
// Get from app.json: expo.extra.eas.projectId
const projectId = Constants.expoConfig?.extra?.eas?.projectId;

const result = await registerForPushNotifications({ 
  projectId 
});
```

**Solution 3: Configure EAS in app.json**
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

---

## Notification Not Received

### Notifications Sent Successfully But Not Appearing

**Checklist:**

1. **Verify Token Type**
   - FCM tokens start with random characters: `fY-peBoPTDiFlpd0fVDfeN:APA91b...`
   - Expo tokens start with: `ExponentPushToken[...]`
   - Make sure you're using the correct token type for your setup

2. **Check Android Notification Channel** (Android 8.0+)
   ```typescript
   import * as Notifications from 'expo-notifications';
   
   await Notifications.setNotificationChannelAsync('default', {
     name: 'Default notifications',
     importance: Notifications.AndroidImportance.MAX,
     vibrationPattern: [0, 250, 250, 250],
     sound: 'default',
   });
   ```

3. **Verify Permissions**
   ```typescript
   const { status } = await requestPushPermissions();
   console.log('Permission status:', status);
   // Should be 'granted'
   ```

4. **Check App State**
   - Notifications may not appear when app is in foreground
   - Test with app in background or closed
   - Configure notification handler for foreground display:
   ```typescript
   Notifications.setNotificationHandler({
     handleNotification: async () => ({
       shouldShowAlert: true,
       shouldPlaySound: true,
       shouldSetBadge: false,
     }),
   });
   ```

5. **Check Device Settings**
   - Verify notifications are enabled in device settings
   - Check "Do Not Disturb" mode is off
   - Verify app has notification permissions

6. **Review FCM/Expo Logs**
   - Check server response for error codes
   - Look for `UNREGISTERED` or `InvalidCredentials` errors

---

## Environment & Configuration

### Error: "Property 'crypto' doesn't exist"

**Symptom:**
```
ReferenceError: Property 'crypto' doesn't exist
```

**Cause:** 
Trying to use `send()`, `sendExpoPush()`, or `sendFcm()` directly from React Native client code.

**Why This Happens:**
The `expo-push-easy` library uses the Web Crypto API (`crypto.subtle`) for JWT signing, which is only available in server-side environments like:
- Node.js
- Convex
- Cloudflare Workers
- Next.js Edge Runtime
- Bun
- Deno

React Native does **not** have `crypto.subtle` available.

**Solution: Use Server-Side Actions**

**❌ Wrong (Client-Side):**
```typescript
// This will fail in React Native
import { send } from 'expo-push-easy';

const result = await send(token, { title, body }, { serviceAccount });
```

**✅ Correct (Server-Side via Convex):**
```typescript
// Client: Call server action
const result = await sendNotification({ userId, title, body });

// Server (Convex action):
import { send } from 'expo-push-easy';

export const sendNotification = action({
  handler: async (ctx, args) => {
    const serviceAccount = process.env.FCM_SERVICE_ACCOUNT;
    return await send(token, { 
      title: args.title, 
      body: args.body 
    }, { serviceAccount });
  },
});
```

---

### Error: "SyntaxError: Expected property name or '}' in JSON"

**Symptom:**
```
SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

**Cause:**
Invalid or malformed `FCM_SERVICE_ACCOUNT` environment variable.

**Solutions:**

**For Convex:**
```bash
# Use the JSON file directly
npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"

# Or set it manually (escape the JSON properly)
npx convex env set FCM_SERVICE_ACCOUNT '{"type":"service_account","project_id":"...","private_key":"..."}'
```

**For Next.js/Node.js (.env):**
```bash
# Use single line with escaped newlines
FCM_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk@your-project.iam.gserviceaccount.com",...}'
```

**Verify the variable is set correctly:**
```bash
# Convex
npx convex env list

# Node.js
node -e "console.log(JSON.parse(process.env.FCM_SERVICE_ACCOUNT))"
```

---

### Missing FCM Service Account

**Symptom:**
```
Error: FCM token detected but no serviceAccount provided
```

**Cause:**
Trying to send to FCM tokens without providing Firebase service account credentials.

**Solution:**

1. **Get Service Account from Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Navigate to **Project Settings** → **Service Accounts**
   - Click **Generate new private key**
   - Save the JSON file

2. **Set Environment Variable:**

   **Convex:**
   ```bash
   npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"
   ```

   **Next.js/Node.js (.env.local):**
   ```env
   FCM_SERVICE_ACCOUNT='{"type":"service_account",...}'
   ```

3. **Use in Code:**
   ```typescript
   import { send } from 'expo-push-easy';
   
   const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!);
   
   const result = await send(token, payload, { serviceAccount });
   ```

---

## FCM Specific Issues

### Error: "UNREGISTERED"

**Symptom:**
```json
{
  "success": false,
  "provider": "fcm",
  "errorCode": "UNREGISTERED",
  "error": "Requested entity was not found."
}
```

**Causes:**
- App was uninstalled
- Token expired or became invalid
- Wrong Firebase project (sender ID mismatch)

**Solution:**
```typescript
// Remove invalid tokens from your database
if (result.errorCode === 'UNREGISTERED') {
  await removeToken(token);
}
```

---

### Error: "SENDER_ID_MISMATCH"

**Symptom:**
```json
{
  "success": false,
  "errorCode": "SENDER_ID_MISMATCH"
}
```

**Cause:**
The FCM token was registered with a different Firebase project.

**Solutions:**
- Verify you're using the correct Firebase service account
- Re-register the device with the correct Firebase project
- Delete the old token and register a new one

---

### Error: "INVALID_ARGUMENT"

**Symptom:**
```json
{
  "success": false,
  "errorCode": "INVALID_ARGUMENT"
}
```

**Causes:**
- Malformed payload
- Invalid token format
- Missing required fields

**Solution:**
```typescript
// Validate your payload
const result = await send(token, {
  title: 'Valid title',        // Required
  body: 'Valid body message',  // Required
  // Optional fields
  deepLink: 'myapp://screen',
  badge: 1,
  sound: 'default',
});
```

---

### Error: "QUOTA_EXCEEDED"

**Symptom:**
```json
{
  "success": false,
  "errorCode": "QUOTA_EXCEEDED"
}
```

**Cause:**
Rate limit exceeded for FCM.

**Solutions:**
- Implement exponential backoff
- Batch notifications instead of sending individually
- Upgrade Firebase plan if needed

```typescript
// Example with retry logic
async function sendWithRetry(token, payload, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const result = await send(token, payload, options);
    
    if (result.success) return result;
    
    if (result.errorCode === 'QUOTA_EXCEEDED') {
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    
    return result;
  }
}
```

---

## Expo Push Specific Issues

### Error: "DeviceNotRegistered"

**Symptom:**
```json
{
  "success": false,
  "errorCode": "DeviceNotRegistered"
}
```

**Cause:**
Similar to FCM's `UNREGISTERED` - the Expo Push Token is no longer valid.

**Solution:**
Remove the token from your database.

---

### Error: "MessageTooBig"

**Symptom:**
```json
{
  "success": false,
  "errorCode": "MessageTooBig"
}
```

**Cause:**
Payload exceeds 4KB limit for Expo Push notifications.

**Solutions:**
- Reduce message size
- Remove large data objects
- Use deep links instead of passing data in payload

---

### Error: "MessageRateExceeded"

**Symptom:**
```json
{
  "success": false,
  "errorCode": "MessageRateExceeded"
}
```

**Cause:**
Too many notifications sent to the same device too quickly.

**Solution:**
Implement rate limiting per device:

```typescript
// Track last send time per token
const lastSent = new Map<string, number>();

async function sendWithRateLimit(token, payload) {
  const now = Date.now();
  const lastSentTime = lastSent.get(token) || 0;
  
  if (now - lastSentTime < 60000) { // 1 minute cooldown
    console.warn('Rate limit: waiting before sending');
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
  
  const result = await send(token, payload);
  lastSent.set(token, now);
  return result;
}
```

---

## Client-Side Errors

### Permissions Denied

**Symptom:**
Permission status returns `'denied'` or `'undetermined'`.

**Solutions:**

1. **Request Again (iOS allows re-prompting):**
   ```typescript
   const status = await requestPushPermissions();
   ```

2. **Direct User to Settings:**
   ```typescript
   import { Linking } from 'react-native';
   
   if (status !== 'granted') {
     Alert.alert(
       'Notifications Disabled',
       'Please enable notifications in Settings',
       [
         { text: 'Cancel', style: 'cancel' },
         { text: 'Open Settings', onPress: () => Linking.openSettings() }
       ]
     );
   }
   ```

---

### Token Refresh Not Working

**Symptom:**
`onTokenRefresh` callback never fires.

**Solution:**
Make sure you're returning the unsubscribe function:

```typescript
useEffect(() => {
  const unsubscribe = onTokenRefresh((newToken) => {
    console.log('Token refreshed:', newToken);
    // Update your backend
  });
  
  return unsubscribe; // Important!
}, []);
```

---

## Server-Side Errors

### Convex: "Environment variable not found"

**Symptom:**
```
Error: FCM_SERVICE_ACCOUNT environment variable is not set
```

**Solution:**
```bash
# Set in Convex
npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"

# Verify
npx convex env list
```

---

### Next.js: Environment Variables Not Available

**Symptom:**
`process.env.FCM_SERVICE_ACCOUNT` is `undefined` in API routes.

**Solutions:**

1. **Use correct env file:**
   - `.env.local` for local development
   - Set in Vercel/hosting platform for production

2. **Don't use NEXT_PUBLIC_ prefix** (for server-side only vars):
   ```env
   # ❌ Wrong (exposes to client)
   NEXT_PUBLIC_FCM_SERVICE_ACCOUNT=...
   
   # ✅ Correct (server-side only)
   FCM_SERVICE_ACCOUNT=...
   ```

3. **Restart dev server** after changing env files

---

## Testing & Debugging

### Enable Detailed Logging

**Client-Side:**
```typescript
const result = await sendNotification({ userId, title, body });
console.log('Full result:', JSON.stringify(result, null, 2));
```

**Server-Side (Convex):**
```typescript
export const sendNotification = action({
  handler: async (ctx, args) => {
    console.log('Sending to tokens:', tokens);
    
    const result = await send(token, payload, { serviceAccount });
    
    console.log('FCM Response:', JSON.stringify(result, null, 2));
    return result;
  },
});
```

**View Logs:**
```bash
# Convex
npx convex logs

# Next.js
# Check terminal where dev server is running
```

---

### Test Notification Delivery

**1. Test with Simple Payload:**
```typescript
const result = await send(token, {
  title: 'Test',
  body: 'Simple test message',
});
```

**2. Check Token Type:**
```typescript
import { detectTokenType } from 'expo-push-easy';

const type = detectTokenType(token);
console.log('Token type:', type); // 'fcm' or 'expo-push'
```

**3. Verify Token is Valid:**
```typescript
// Token should not be empty or undefined
console.log('Token length:', token.length);
console.log('Token prefix:', token.substring(0, 20));
```

**4. Test in Different App States:**
- Foreground (app open)
- Background (app minimized)
- Killed (app closed)

---

### Common Debugging Commands

```bash
# Convex
npx convex logs              # View real-time logs
npx convex env list          # List environment variables
npx convex dev               # Start dev server with logs

# Expo
npx expo start --clear       # Clear cache and restart
npx expo doctor              # Check for issues

# Check token in database
# Use your database client to verify tokens are saved correctly
```

---

## Getting Help

If you're still stuck after trying these solutions:

1. **Check the logs** - Most issues show detailed error messages
2. **Verify all environment variables** are set correctly
3. **Test with minimal payload** - Remove optional fields
4. **Check GitHub Issues** - [expo-push-easy issues](https://github.com/yoh-space/expo-push-easy/issues)
5. **Review the examples** - The Convex example shows a complete working setup

### Useful Resources

- [expo-push-easy Documentation](https://github.com/yoh-space/expo-push-easy)
- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Convex Documentation](https://docs.convex.dev)

---

## Quick Reference: Error Code Index

| Error Code | Provider | Meaning | Action |
|------------|----------|---------|--------|
| `UNREGISTERED` | FCM | Token invalid/expired | Remove token |
| `SENDER_ID_MISMATCH` | FCM | Wrong Firebase project | Re-register device |
| `INVALID_ARGUMENT` | FCM | Malformed payload | Check payload format |
| `QUOTA_EXCEEDED` | FCM | Rate limit hit | Implement backoff |
| `UNAVAILABLE` | FCM | Transient server error | Retry with backoff |
| `DeviceNotRegistered` | Expo | Token invalid | Remove token |
| `MessageTooBig` | Expo | Payload > 4KB | Reduce message size |
| `MessageRateExceeded` | Expo | Too many messages | Rate limit sends |
| `InvalidCredentials` | Expo | Bad access token | Check Expo credentials |

---

*Last updated: 2025*
