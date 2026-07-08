# expo-push-easy

Send push notifications from any JavaScript runtime — FCM v1, zero painful config.

```ts
import { sendFcm } from 'expo-push-easy'

const result = await sendFcm(token, { title: 'Hello', body: 'World' }, serviceAccount)
// { success: true, fcmMessageId: "projects/.../messages/..." }
```

## Why

Push notifications are simple in concept but painful in practice:
- FCM v1 requires OAuth2 JWT assertions
- `jsonwebtoken` doesn't work in V8 runtimes (Convex, Cloudflare Workers)
- The FCM v1 payload uses snake_case (`channel_id`, `default_sound`) — your IDE won't warn you
- Expo Push tokens and FCM tokens need different APIs

**expo-push-easy** wraps all of that into one function call. **Zero runtime dependencies** — uses Web Crypto API (`crypto.subtle`) so it works in Node.js, Convex, Cloudflare Workers, Bun, and Deno.

## Install

```bash
npm install expo-push-easy
# or
pnpm add expo-push-easy
```

## Usage

### Send to a single device (FCM)

```ts
import { sendFcm } from 'expo-push-easy'

const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)

const result = await sendFcm('fMcA6s8Abx0:APA91bHZnc...', {
  title: 'Order Shipped',
  body: 'Your package is on the way!',
  data: { screen: '/orders', orderId: '123' },
  android: { channelId: 'orders', priority: 'HIGH' },
}, serviceAccount)

console.log(result)
// { success: true, provider: 'fcm', fcmMessageId: 'projects/.../messages/...', status: 200 }
```

### Send in Convex

```ts
// convex/sendPush.ts
import { action } from './_generated/server'
import { v } from 'convex/values'
import { sendFcm } from 'expo-push-easy'

export const send = action({
  args: { token: v.string(), title: v.string(), body: v.string() },
  handler: async (_ctx, args) => {
    const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!)
    return sendFcm(args.token, { title: args.title, body: args.body }, sa)
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
  const result = await sendFcm(token, { title, body }, sa)
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
  const result = await sendFcm(token, { title, body }, sa)
  res.json(result)
})
```

### Send to multiple devices

```ts
const results = await Promise.all(
  tokens.map(token => sendFcm(token, { title: 'Broadcast', body: 'Hello!' }, sa))
)
```

## API

### `sendFcm(token, payload, serviceAccount)`

| Param | Type | Description |
|-------|------|-------------|
| `token` | `string` | FCM device token |
| `payload` | `PushPayload` | Notification payload |
| `serviceAccount` | `ServiceAccount \| string` | Firebase service account (object or JSON string) |

Returns `Promise<PushResult>`

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

The JSON object from Firebase Console → Project Settings → Service Accounts → Generate new private key.

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
