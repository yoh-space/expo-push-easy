# expo-push-easy

[![CI](https://github.com/yoh-space/expo-push-easy/actions/workflows/ci.yml/badge.svg)](https://github.com/yoh-space/expo-push-easy/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/expo-push-easy.svg?style=flat-flat)](https://www.npmjs.com/package/expo-push-easy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007acc.svg)](https://www.typescriptlang.org/)

**The ultimate zero-dependency React Native & Expo push notification gateway for modern JavaScript runtimes.** Send notifications to Expo Push and raw Firebase Cloud Messaging (FCM v1) tokens with a single unified API. Works seamlessly in Node.js, Convex, Cloudflare Workers, Next.js Edge, Bun, and Deno.

```ts
import { send } from 'expo-push-easy'

const result = await send('ExponentPushToken[xxxx]', {
  title: 'Order Delivered! 📦',
  body: 'Your package has been dropped off at your front door.',
  deepLink: 'myapp://orders/123'
})
```

---

## Why expo-push-easy?

Push notifications are simple in concept but painful in practice:
- **FCM v1 Auth Hassles**: Firebase Cloud Messaging v1 requires exchanging custom RS256 signed JWT assertions for OAuth2 credentials.
- **Runtime Limitations**: Standard packages like `jsonwebtoken` and `googleapis` rely on Node.js-specific libraries (like `crypto`) and **fail in V8 edge runtimes** like Convex, Cloudflare Workers, and Next.js Edge.
- **Inconsistent APIs**: Expo Push tokens and native FCM device registration tokens require entirely different API targets and schemas.
- **Schema Key Translating**: FCM v1 uses nested, `snake_case` properties (such as `channel_id` or `click_action`), whereas Expo uses `camelCase` (such as `channelId` or `categoryId`).

**expo-push-easy** wraps all of that complexity into a single, unified, **zero-dependency** helper utilizing the native Web Crypto API (`crypto.subtle`) and standard `fetch()`.

### How this compares to the alternatives

| | `expo-push-easy` | `expo-server-sdk` | `firebase-admin` |
|---|---|---|---|
| Works in Convex / Cloudflare Workers / Next.js Edge | ✅ | ❌ (Node-only, no edge support) | ❌ (depends on Node `crypto`, `net`, `tls`) |
| Sends to Expo Push tokens | ✅ | ✅ | ❌ |
| Sends to raw FCM v1 tokens | ✅ | ❌ | ✅ |
| Single unified API for both token types | ✅ | ❌ | ❌ |
| Dependency footprint | Zero runtime deps | Several (Node-only) | Large (`googleapis`, gRPC, etc.) |
| JWT signing method | Web Crypto (`crypto.subtle`) | N/A | Node `crypto` / `googleapis` |
| Built-in Convex/Supabase/Firestore token storage | ✅ | ❌ | ❌ |

The short version: if your backend runs on Node.js and you only ever send to Expo tokens, `expo-server-sdk` is fine. But the moment your backend runs in an isolate/edge runtime (Convex functions, Cloudflare Workers, Next.js Edge middleware/routes) — which is increasingly common — `jsonwebtoken` and `googleapis`-based libraries throw at runtime because they expect Node's native `crypto`, `net`, and `tls` modules that don't exist in V8 isolates. `expo-push-easy` exists specifically to be usable in both worlds without a rewrite.

---

## 🚀 Key Features

*   **Unified Push Gateway**: Route notifications to Expo Push tokens and native FCM v1 tokens using the same function.
*   **Zero Dependencies**: Written in pure JavaScript using native `fetch` and the Web Crypto API (`crypto.subtle`) for RS256 JWT signatures. Works in V8 environments (like Convex and Cloudflare) where Node.js `crypto` or `jsonwebtoken` fail.
*   **Production-Ready Token Storage**: Pre-built adapters for **Convex**, **Supabase**, and **Firebase Firestore** to handle registration, updates, and cleanup.
*   **Double-Ended Scheduling**: Orchestrate delayed backend messages or schedule offline, device-local alarms inside the client.
*   **Rich Layouts**: Direct overrides for Android channels, iOS/APNs alert structures, WebPush actions, badges, deep links, custom sounds, and images.

---

## ⚡ Quickstart (5 Minutes)

### 1. Installation

Install the library in your server-side environment:

```bash
npm install expo-push-easy
# or
pnpm add expo-push-easy
# or
yarn add expo-push-easy
```

### 2. Configure Firebase Credentials (FCM v1)

To send to raw Android/iOS FCM tokens, generate your Service Account JSON file:
1. Go to the **Firebase Console**.
2. Navigate to **Project Settings** -> **Service Accounts**.
3. Click **Generate new private key** and save the file securely.
4. Set it as an environment variable (e.g., `FCM_SERVICE_ACCOUNT`).

### 3. Send Notifications

```ts
import { send } from 'expo-push-easy'

const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)

// Detects token type automatically and routes correctly
const result = await send('your-device-push-token', {
  title: 'Welcome! 👋',
  body: 'Thanks for signing up to our app.',
  deepLink: 'myapp://settings/profile' // Cross-platform deep linking
}, {
  serviceAccount
})

if (result.success) {
  console.log(`Delivered via ${result.provider}. ID: ${result.fcmMessageId || result.expoPushTicketId}`)
} else {
  console.error(`Failed: ${result.error} (Code: ${result.errorCode})`)
}
```

---

## 📖 How It Works Under the Hood

```
   Your Application Code
            │
            ▼
    send(token, payload)
            │
            ├──► Auto-Detect Token Type (starts with "ExponentPushToken"?)
            │
            ├──► [Expo Token Route] ────────► HTTP POST to Expo Push API
            │                                 https://exp.host/--/api/v2/push/send
            │
            └──► [FCM Token Route] ─────────► 1. Sign JWT with Web Crypto (RS256)
                                              2. Exchange for Google OAuth2 Token
                                                 (Cached for 1 hour)
                                              3. HTTP POST to FCM v1 API
                                                 https://fcm.googleapis.com/v1/...
```

---

## 🛠️ Server-Side Integration Guides

### Next.js (App Router)

```ts
// app/api/push/route.ts
import { send } from 'expo-push-easy'

export async function POST(req: Request) {
  try {
    const { token, title, body, deepLink } = await req.json()
    const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)

    const result = await send(token, { title, body, deepLink }, { serviceAccount: sa })
    return Response.json(result)
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 500 })
  }
}
```

### Express.js

```ts
import { send } from 'expo-push-easy'
import express from 'express'

const app = express()
app.use(express.json())

app.post('/api/notify', async (req, res) => {
  const { token, title, body } = req.body
  const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)

  const result = await send(token, { title, body }, { serviceAccount: sa })
  res.json(result)
})
```

### Convex Actions

Since Convex runs on lightweight V8 isolates, standard Node libraries fail. `expo-push-easy` works natively.

#### 1. Define schema (`convex/schema.ts`):
```ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { getConvexTableDefinition } from "expo-push-easy/adapters"

export default defineSchema({
  // Pre-configured table for mapping userIds to push tokens
  pushTokens: getConvexTableDefinition(defineTable, v),
})
```

#### 2. Register mutations (`convex/pushTokens.ts`):
```ts
import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { convexTokenHelpers } from "expo-push-easy/adapters"

export const saveToken = mutation({
  args: { token: v.string(), platform: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthenticated")
    
    await convexTokenHelpers.saveToken(ctx.db, identity.subject, args.token, args.platform)
  },
})
```

#### 3. Send Notification Action (`convex/notify.ts`):
```ts
import { action } from "./_generated/server"
import { v } from "convex/values"
import { send } from "expo-push-easy"
import { convexTokenHelpers } from "expo-push-easy/adapters"

export const sendNotification = action({
  args: { userId: v.string(), title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)
    
    // Retrieve tokens from Convex database
    const tokens = await ctx.runQuery(internal.pushTokens.getTokensQuery, { userId: args.userId })
    
    for (const record of tokens) {
      await send(record.token, { title: args.title, body: args.body }, { serviceAccount: sa })
    }
  },
})
```

### Supabase Edge Functions

#### 1. Table Migration Schema SQL
Run this DDL statement in your Supabase SQL editor:
```sql
CREATE TABLE IF NOT EXISTS public.user_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT, -- 'ios' | 'android' | 'web'
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, token)
);

ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can edit their own tokens" ON public.user_tokens
  FOR ALL USING (auth.uid() = user_id);
```

#### 2. Upsert Token inside Edge Function or Client
```ts
import { createClient } from '@supabase/supabase-js'
import { createSupabaseTokenStore } from 'expo-push-easy/adapters'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const tokenStore = createSupabaseTokenStore(supabase)

// Upserts user_id/token combination automatically
await tokenStore.saveToken(session.user.id, pushToken, Platform.OS)
```

---

## 📱 Client App Setup (Expo SDK 55 & 56)

For Expo SDK 55 and SDK 56, the `expo-notifications` setup must be configured using config plugins in your project's `app.json`.

### 1. Install Client Dependencies

```bash
npx expo install expo-notifications expo-device expo-constants
```

### 2. Configure `app.json`

Add the `expo-notifications` config plugin to register native permissions:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/custom-alert.wav"]
        }
      ]
    ]
  }
}
```

### 3. Register Token on Launch

Import from the `expo-push-easy/client` subpath:

```ts
import { registerForPushNotifications, onTokenRefresh } from 'expo-push-easy/client'
import { useEffect } from 'react'
import { Platform } from 'react-native'

export default function RootLayout() {
  useEffect(() => {
    async function initPush() {
      try {
        const { token, type } = await registerForPushNotifications({
          projectId: 'your-eas-project-id' // Found in extra.eas.projectId inside app.json
        })
        console.log(`Registered token: ${token} (${type})`)
        // Upload token to database (e.g. Supabase, Convex or Firestore)
      } catch (err) {
        console.warn('Push registration failed:', err)
      }
    }

    initPush()

    // Listen to native OS token updates
    const unsubscribe = onTokenRefresh((newToken) => {
      console.log('Push token updated:', newToken.token)
      // Send refreshed token to database
    })

    return unsubscribe
  }, [])
}
```

---

## 🔗 Deep Linking with Expo Router

Expo Router matches linking schemes automatically. Pass the destination route using the unified `deepLink` property on the backend:

```ts
// Server Dispatch
await send(token, {
  title: 'New Message! 💬',
  body: 'Click here to read it.',
  deepLink: 'myapp://chat/alice' // Scheme must match expo.scheme in app.json
}, { serviceAccount })
```

In your React Native App, monitor notification taps and trigger routing:

```ts
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect } from 'react'

export default function Layout() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      const url = data?.url || data?._deepLink
      if (url) {
        // Redirect using expo-router
        router.push(url.replace('myapp://', '/'))
      }
    })
    return () => subscription.remove()
  }, [])
}
```

---

## 🎨 Rich Media & Platform Overrides

Customize push notification options such as badge counts, sounds, colors, and media headers:

```ts
await send(token, {
  title: 'Rich Alert 🎥',
  body: 'This notification contains images and custom actions',
  image: 'https://example.com/media.jpg', // Inline images
  sound: 'custom-alert.wav',              // Custom audio file name
  badge: 2,                                // App icon badge overlay count
  
  android: {
    channelId: 'announcements',
    color: '#FF0000',
    sticky: false,
    ttl: 3600, // Seconds cached in offline queues
  },
  
  apns: {
    payload: {
      aps: {
        mutableContent: true, // Enables iOS Notification Service Extension to load rich images
        interruptionLevel: 'time-sensitive', // passive | active | time-sensitive | critical
      }
    }
  }
}, { serviceAccount })
```

---

## ⏰ Dual-End Scheduling

### Server-Side Delayed Delivery (`expo-push-easy/scheduling`)

Stage backend notifications with sending-time rules. You can process due notifications using cron tasks or background workers:

```ts
import { createScheduledPush, processScheduledPushes, InMemoryScheduleStore } from 'expo-push-easy/scheduling'

const store = new InMemoryScheduleStore()

// Stage notification for 2 hours from now
const sendAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
const job = createScheduledPush(
  'ExponentPushToken[xxx]',
  { title: 'Reminder', body: 'Finish your workout!' },
  sendAt,
  { serviceAccount }
)

await store.save(job)

// Run this processing hook inside your serverless cron action or worker loop:
// This collects due jobs, sends them, and updates their status to 'sent' or 'failed'.
const results = await processScheduledPushes(store)
```

### Device-Local Scheduling (`expo-push-easy/client`)

Schedule immediate alerts or periodic alarms offline on the user's phone, without calling server APIs:

```ts
import { scheduleLocalNotification, cancelScheduledNotification } from 'expo-push-easy/client'

// Schedule local notification in 1 minute
const notifId = await scheduleLocalNotification({
  title: 'Drink Water! 💧',
  body: 'Time to drink your next glass.',
  trigger: {
    type: 'timeInterval',
    seconds: 60,
    repeats: false
  }
})

// Cancel later
await cancelScheduledNotification(notifId)
```

---

## 📖 API Reference

### Core Module (`expo-push-easy`)

#### `send(token, payload, options)`
Dispatches notification to target destination. Returns a unified `PushResult`.
- `token`: `string` - Expo Push Token (`ExponentPushToken[...]`) or raw FCM Registration Token.
- `payload`: `PushPayload` - Core configuration block.
- `options`: `SendOptions` - Connection configurations.

#### `sendBatch(pushes, options)`
Fires parallel notification dispatches. Returns a collection of results.
- `pushes`: `{ token: string; payload: PushPayload }[]`
- `options`: `SendOptions`

#### `clearFcmTokenCache()`
Evicts all cached Google OAuth access credentials.

#### `getFcmTokenCacheSize()`
Returns the size of the cached FCM tokens map.

---

### Type Definitions

#### `PushPayload`
| Property | Type | Description |
|---|---|---|
| `title` | `string` | **Required**. Main bold title text. |
| `body` | `string` | **Required**. Summary details text. |
| `subtitle` | `string` | Secondary subtitle text (iOS only). |
| `image` | `string` | URL of the image asset. |
| `sound` | `string \| boolean` | Filename or `true` for standard system sound. |
| `badge` | `number` | Counter integer overlay on App icon. |
| `data` | `Record<string, unknown>` | Custom payload details. Auto-stringified on FCM. |
| `deepLink` | `string` | Target deep link route (`_deepLink` on FCM, `url` on Expo). |
| `android` | `AndroidConfig` | Native Android overrides. |
| `apns` | `ApnsConfig` | Native APNs/iOS overrides. |
| `web` | `WebConfig` | Web Push notification overrides. |

#### `PushResult`
| Property | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` if delivery was accepted by the destination gateway. |
| `provider` | `'fcm' \| 'expo-push'` | Transport service route chosen. |
| `status` | `number` | Gateway HTTP response code. |
| `error` | `string` | Error description if delivery fails. |
| `errorCode` | `string` | Standardized error string code (e.g. `UNREGISTERED`). |
| `expoPushTicketId` | `string` | Expo Push Ticket ID (used to query delivery status). |
| `fcmMessageId` | `string` | FCM confirmation message name identifier. |
| `token` | `string` | The target token this result corresponds to. |

---

## ⚡ Production Best Practices

### Handling Invalid/Unregistered Tokens
To keep your database clean, listen for `errorCode` status changes. If the target gateway returns an unregistered code, purge the token from your store immediately to prevent performance and resource degradation:

```ts
const result = await send(token, payload, { serviceAccount })

if (!result.success) {
  const isStale = result.errorCode === 'UNREGISTERED' || result.errorCode === 'DeviceNotRegistered'
  if (isStale) {
    // Purge token from your Convex/Supabase/Firestore database
    await tokenStore.removeToken(token)
  }
}
```

### Common Failure Modes & Error Codes

`result.error` and `result.errorCode` surface the raw response from whichever gateway handled the token. The values differ by provider — handle both:

| Provider | `errorCode` | Meaning | Recommended action |
|---|---|---|---|
| FCM v1 | `UNREGISTERED` | Token is expired, uninstalled, or otherwise invalid. | Delete the token from your store immediately. |
| FCM v1 | `INVALID_ARGUMENT` | Malformed request (bad token format, invalid payload field). | Log and inspect payload; do not retry as-is. |
| FCM v1 | `SENDER_ID_MISMATCH` | Token belongs to a different Firebase project than your service account. | Delete the token; it can never succeed for this project. |
| FCM v1 | `QUOTA_EXCEEDED` | You've hit FCM's rate limit for this project/token. | Retry with exponential backoff; consider batching sends. |
| FCM v1 | `UNAVAILABLE` | Transient FCM server issue. | Retry with backoff; not caused by your request. |
| FCM v1 | `INTERNAL` | Unexpected FCM server error. | Retry with backoff. |
| Expo Push | `DeviceNotRegistered` | Token is no longer valid (app uninstalled, etc). | Delete the token from your store immediately. |
| Expo Push | `MessageTooBig` | Payload exceeds Expo's size limit (4KB). | Trim payload data before resending. |
| Expo Push | `MessageRateExceeded` | Too many messages sent to this device too quickly. | Retry with backoff; throttle sends to that token. |
| Expo Push | `InvalidCredentials` | Your Expo push credentials are misconfigured. | Check your Expo access token / project setup, not the target token. |

**Rate limits**: neither FCM nor Expo Push guarantee unlimited throughput. If you're sending to more than a handful of tokens, use `sendBatch()` rather than firing many `send()` calls in a tight loop, and add your own delay/backoff between batches if you see `QUOTA_EXCEEDED` or `MessageRateExceeded` in results. This library does not currently retry automatically — retries are left to the caller so you can apply backoff logic appropriate to your own traffic patterns.

**Network/transport failures** (timeouts, DNS errors, offline device at send time): these surface as `success: false` with a stringified error in `result.error` and no `errorCode`, since the request never reached the gateway. Treat missing `errorCode` as "unknown/transient" — safe to retry, not safe to assume the token is dead.

---

## License

MIT
