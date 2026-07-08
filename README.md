# expo-push-easy

Send push notifications from any JavaScript runtime with one small API.

```ts
import { send } from 'expo-push-easy'

const result = await send(token, { title: 'Hello', body: 'World' }, {
  serviceAccount,
})
// { success: true, provider: 'fcm', fcmMessageId: 'projects/.../messages/...' }
```

## Why

Push notifications are simple in concept but painful in practice:
- FCM v1 requires OAuth2 JWT assertions
- `jsonwebtoken` does not work in V8 runtimes like Convex and Cloudflare Workers
- FCM v1 uses snake_case fields such as `channel_id`
- Expo Push tokens and FCM tokens need different APIs

**expo-push-easy** wraps that into a small set of helpers. It has **zero npm dependencies** and uses the Web Crypto API (`crypto.subtle`), so it works in Node.js, Convex, Cloudflare Workers, Bun, and Deno.

## Install

```bash
npm install expo-push-easy
# or
pnpm add expo-push-easy
```

## Usage

### Send to a single device

```ts
import { send } from 'expo-push-easy'

const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)

const result = await send('fMcA6s8Abx0:APA91bHZnc...', {
  title: 'Order Shipped',
  body: 'Your package is on the way!',
  data: { screen: '/orders', orderId: '123' },
  android: { channelId: 'orders', priority: 'HIGH' },
}, {
  serviceAccount,
})

console.log(result)
// { success: true, provider: 'fcm', fcmMessageId: 'projects/.../messages/...', status: 200 }
```

`send()` detects Expo Push tokens automatically and routes them to Expo, so you can use one function for both token types.

### Send to Expo Push tokens

```ts
import { sendExpoPush } from 'expo-push-easy'

const result = await sendExpoPush('ExponentPushToken[abc]', {
  title: 'Order Shipped',
  body: 'Your package is on the way!',
})

console.log(result)
// { success: true, provider: 'expo-push', status: 200 }
```

### Send to FCM tokens directly

```ts
import { sendFcm } from 'expo-push-easy'

const result = await sendFcm('fMcA6s8Abx0:APA91bHZnc...', {
  title: 'Order Shipped',
  body: 'Your package is on the way!',
}, serviceAccount)
```

### Send in Convex

```ts
// convex/sendPush.ts
import { action } from './_generated/server'
import { v } from 'convex/values'
import { send as sendPush } from 'expo-push-easy'

export const sendPushNotification = action({
  args: { token: v.string(), title: v.string(), body: v.string() },
  handler: async (_ctx, args) => {
    const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)
    return sendPush(args.token, { title: args.title, body: args.body }, { serviceAccount: sa })
  },
})
```

### Send in Next.js

```ts
// app/api/push/route.ts
import { sendFcm } from 'expo-push-easy'

export async function POST(req: Request) {
  const { token, title, body } = await req.json()
  const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)
  const result = await send(token, { title, body }, { serviceAccount: sa })
  return Response.json(result)
}
```

### Send in Express

```ts
import { sendFcm } from 'expo-push-easy'
import express from 'express'

const app = express()
app.post('/notify', async (req, res) => {
  const { token, title, body } = req.body
  const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)
  const result = await send(token, { title, body }, { serviceAccount: sa })
  res.json(result)
})
```

### Send to multiple devices

```ts
const results = await sendBatch(
  tokens.map((token) => ({
    token,
    payload: { title: 'Broadcast', body: 'Hello!' },
  })),
  { serviceAccount: sa },
)

// For mixed token types, omit serviceAccount only if every token is Expo Push.
```

## API

### `send(token, payload, options)`

Auto-detects token type and routes to Expo Push or FCM.

| Param | Type | Description |
|-------|------|-------------|
| `token` | `string` | Expo Push token or FCM device token |
| `payload` | `PushPayload` | Notification payload |
| `options.serviceAccount` | `ServiceAccount \| string` | Required for FCM tokens, ignored for Expo Push tokens |
| `options.throwOnError` | `boolean` | Throw instead of returning an error result |

Returns `Promise<PushResult>`

### `sendBatch(pushes, options)`

Sends an array of `{ token, payload }` items with the same options object.

| Param | Type | Description |
|-------|------|-------------|
| `pushes` | `{ token: string; payload: PushPayload }[]` | Push jobs to send |
| `options` | `SendOptions` | Same options passed to each send |

Returns `Promise<PushResult[]>`

### `sendFcm(token, payload, serviceAccount)`

| Param | Type | Description |
|-------|------|-------------|
| `token` | `string` | FCM device token |
| `payload` | `PushPayload` | Notification payload |
| `serviceAccount` | `ServiceAccount` | Firebase service account object |

Returns `Promise<PushResult>`

### `sendExpoPush(token, payload)`

| Param | Type | Description |
|-------|------|-------------|
| `token` | `string` | Expo Push token |
| `payload` | `PushPayload` | Notification payload |

Returns `Promise<PushResult>`

### `detectTokenType(token)`

Returns `'expo-push'` for tokens that start with `ExponentPushToken`, otherwise returns `'fcm'`.

### `PushPayload`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | yes | Notification title |
| `body` | `string` | yes | Notification body |
| `data` | `Record<string, string>` | no | Custom data payload |
| `android.channelId` | `string` | no | Android notification channel ID |
| `android.priority` | `'HIGH' \| 'NORMAL'` | no | FCM delivery priority (default: `'HIGH'`) |

### `PushResult`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the push was accepted by FCM |
| `provider` | `'fcm'` | Which provider was used |
| `status` | `number` | HTTP status code |
| `error` | `string` | Error message (if failed) |
| `fcmMessageId` | `string` | FCM message ID (if success) |

### `ServiceAccount`

The JSON object from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | `string` | Firebase project ID |
| `client_email` | `string` | Service account email |
| `private_key` | `string` | RSA private key (PEM format) |

## How it works

```
Your code
    │
    ▼
sendFcm(token, payload, serviceAccount)
    │
    ├── 1. Sign JWT with Web Crypto (RS256)
    │       { iss: client_email, scope: firebase.messaging, ... }
    │       signed with service account private key
    │
    ├── 2. Exchange JWT for OAuth2 access token
    │       POST https://oauth2.googleapis.com/token
    │
    ├── 3. Call FCM v1 API
    │       POST https://fcm.googleapis.com/v1/projects/{id}/messages:send
    │       Authorization: Bearer {accessToken}
    │       Body: { message: { token, notification, android, data } }
    │
    └── 4. Return { success, fcmMessageId, status, error }
```

The OAuth token is cached for 1 hour (refetched automatically when expired).

## Zero dependencies

This library has **no npm dependencies**. It uses:
- **Web Crypto API** (`crypto.subtle`) for JWT signing — works in Node.js 18+, modern browsers, Convex, Cloudflare Workers, Bun, Deno
- **`fetch()`** for HTTP calls — built into Node.js 18+
- **No `jsonwebtoken`** — that package requires Node.js built-in `crypto` module which isn't available in V8-only runtimes like Convex

## Requirements

- Node.js 18+ (for `fetch` and `crypto.subtle`)
- A Firebase project with Cloud Messaging enabled
- A Firebase service account (JSON key)

## License

MIT
