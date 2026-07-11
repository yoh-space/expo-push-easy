# expo-push-easy Setup Guide

Complete guide to setting up push notifications with `expo-push-easy` in your React Native/Expo app.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Firebase Setup (for FCM v1)](#firebase-setup-for-fcm-v1)
- [Client Setup (React Native/Expo)](#client-setup-react-nativeexpo)
- [Server Setup](#server-setup)
  - [Convex](#convex-backend)
  - [Next.js](#nextjs-backend)
  - [Express](#express-backend)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- React Native or Expo project
- Firebase account (for FCM tokens)
- One of the supported backends: Convex, Next.js, Express, or any Node.js environment

---

## Installation

### 1. Install the Library

```bash
npm install expo-push-easy
# or
pnpm add expo-push-easy
# or
yarn add expo-push-easy
```

### 2. Install Expo Dependencies

```bash
npx expo install expo-notifications expo-device expo-constants
```

---

## Firebase Setup (for FCM v1)

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Follow the setup wizard

### 2. Add Your App to Firebase

#### For Android:
1. In Firebase Console, click the Android icon
2. Enter your package name (found in `app.json` under `android.package`)
3. Download `google-services.json`
4. Place it in your project root or `android/app/` directory

#### For iOS:
1. In Firebase Console, click the iOS icon
2. Enter your bundle ID (found in `app.json` under `ios.bundleIdentifier`)
3. Download `GoogleService-Info.plist`
4. Place it in your project root or `ios/` directory

### 3. Generate Service Account Key

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Save the JSON file securely
4. **⚠️ NEVER commit this file to version control**

---

## Client Setup (React Native/Expo)

### 1. Configure app.json

Add the Firebase configuration files to your `app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "package": "com.yourcompany.yourapp"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "bundleIdentifier": "com.yourcompany.yourapp"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ]
  }
}
```

### 2. Create Notification Setup File

Create `lib/notifications.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set up notification handler
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Create Android notification channel (required for Android 8.0+)
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
}
```

### 3. Register for Push Notifications

In your main component or app entry point:

```typescript
import { useEffect, useState } from 'react';
import {
  requestPushPermissions,
  registerForPushNotifications,
  onTokenRefresh,
} from 'expo-push-easy/client';
import { setupNotificationHandler, setupNotificationChannel } from '@/lib/notifications';

// Initialize notification handler
setupNotificationHandler();

export default function App() {
  const [token, setToken] = useState('');

  useEffect(() => {
    // Setup notification channel for Android
    setupNotificationChannel();

    // Register for push notifications
    async function register() {
      try {
        // Request permissions
        const permission = await requestPushPermissions();
        if (permission !== 'granted') {
          console.log('Permission not granted');
          return;
        }

        // Register and get FCM token
        const result = await registerForPushNotifications({
          useDevicePushToken: true  // Get raw FCM token
        });

        setToken(result.token);
        console.log('FCM Token:', result.token);

        // TODO: Send token to your backend
        // await saveTokenToBackend(result.token);
      } catch (error) {
        console.error('Registration failed:', error);
      }
    }

    register();

    // Listen for token refresh
    const unsubscribe = onTokenRefresh((newToken) => {
      setToken(newToken.token);
      console.log('Token refreshed:', newToken.token);
      // TODO: Update token on your backend
    });

    return unsubscribe;
  }, []);

  return (
    // Your app content
  );
}
```

---

## Server Setup

### Convex Backend

#### 1. Install Convex

```bash
npm install convex
npx convex dev
```

#### 2. Define Schema

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { getConvexTableDefinition } from "expo-push-easy/adapters";

export default defineSchema({
  pushTokens: getConvexTableDefinition(defineTable, v),
});
```

#### 3. Create Token Management

Create `convex/pushTokens.ts`:

```typescript
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { convexTokenHelpers } from 'expo-push-easy/adapters';

export const saveToken = mutation({
  args: {
    userId: v.string(),
    token: v.string(),
    platform: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await convexTokenHelpers.saveToken(ctx.db, args.userId, args.token, args.platform);
    return { ok: true };
  },
});

export const getTokensForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await convexTokenHelpers.getTokensForUser(ctx.db, args.userId);
  },
});

export const removeToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await convexTokenHelpers.removeToken(ctx.db, args.token);
    return { ok: true };
  },
});
```

#### 4. Create Notification Action

Create `convex/notify.ts`:

```typescript
import { v } from 'convex/values';
import { action } from './_generated/server';
import { api } from './_generated/api';
import { send } from 'expo-push-easy';

export const sendNotificationToUser = action({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const serviceAccount = process.env.FCM_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      throw new Error('FCM_SERVICE_ACCOUNT environment variable not set');
    }

    const tokens = await ctx.runQuery(api.pushTokens.getTokensForUser, {
      userId: args.userId,
    });

    if (tokens.length === 0) {
      return { ok: false, sent: 0, error: 'No tokens found' };
    }

    const results = await Promise.all(
      tokens.map((record) =>
        send(
          record.token,
          {
            title: args.title,
            body: args.body,
            deepLink: args.deepLink,
            android: {
              channelId: 'default',
              priority: 'HIGH',
            },
          },
          { serviceAccount: JSON.parse(serviceAccount) }
        )
      )
    );

    const successCount = results.filter((r) => r.success).length;

    return {
      ok: successCount > 0,
      sent: successCount,
      results,
    };
  },
});
```

#### 5. Set Environment Variable

**⚠️ CRITICAL STEP**: Set your Firebase service account in Convex:

```bash
npx convex env set FCM_SERVICE_ACCOUNT '{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}'
```

**Tip**: Read from file to avoid errors:

```bash
npx convex env set FCM_SERVICE_ACCOUNT "$(cat path/to/service-account.json)"
```

---

### Next.js Backend

#### 1. Create API Route

Create `app/api/notify/route.ts`:

```typescript
import { send } from 'expo-push-easy';

export async function POST(req: Request) {
  try {
    const { token, title, body, deepLink } = await req.json();
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!);

    const result = await send(token, { title, body, deepLink }, { serviceAccount });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

#### 2. Set Environment Variable

Add to `.env.local`:

```bash
FCM_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

---

### Express Backend

```typescript
import express from 'express';
import { send } from 'expo-push-easy';

const app = express();
app.use(express.json());

app.post('/api/notify', async (req, res) => {
  const { token, title, body } = req.body;
  const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT!);

  const result = await send(token, { title, body }, { serviceAccount });
  res.json(result);
});

app.listen(3000);
```

---

## Testing

### 1. Test Token Registration

```typescript
const result = await registerForPushNotifications({ useDevicePushToken: true });
console.log('Token:', result.token);
console.log('Type:', result.type); // Should be 'fcm' or 'ios'
```

### 2. Test Notification Send

```typescript
const result = await send(token, {
  title: 'Test Notification',
  body: 'Hello from expo-push-easy!',
});

console.log('Success:', result.success);
console.log('Provider:', result.provider);
console.log('Error:', result.error);
```

### 3. Check Device

- Ensure app is in background or device is locked
- Check notification tray
- Check system notification settings for your app

---

## Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

---

## Next Steps

- [API Reference](../README.md#api-reference)
- [Advanced Features](../README.md#rich-media--platform-overrides)
- [Deep Linking](../README.md#deep-linking-with-expo-router)
- [Production Best Practices](../README.md#production-best-practices)
