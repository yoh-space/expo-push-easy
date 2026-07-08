import { describe, it, expect } from 'vitest'
import { buildFcmPayload, buildExpoPushPayload } from '../src/payload.js'

describe('buildFcmPayload - Rich Mappings', () => {
  it('maps image, subtitle, sound, badge, categoryIdentifier and deepLink', () => {
    const payload = {
      title: 'Rich Title',
      body: 'Rich Body',
      subtitle: 'iOS Subtitle',
      image: 'https://example.com/image.png',
      sound: 'custom.mp3',
      badge: 5,
      categoryIdentifier: 'CATEG_ID',
      deepLink: 'myapp://orders/123',
      data: { key1: 100, key2: true, key3: { nested: 'value' } },
    }

    const result = buildFcmPayload('fcm-token', payload)
    
    // Top-level message contains token & notification with image
    expect(result.message.token).toBe('fcm-token')
    expect(result.message.notification).toEqual({
      title: 'Rich Title',
      body: 'Rich Body',
      image: 'https://example.com/image.png',
    })

    // Data stringified
    expect(result.message.data).toEqual({
      key1: '100',
      key2: 'true',
      key3: JSON.stringify({ nested: 'value' }),
      _deepLink: 'myapp://orders/123',
    })

    // Android notification count and sound overrides
    expect(result.message.android).toEqual({
      priority: 'HIGH',
      notification: {
        sound: 'custom.mp3',
        notification_count: 5,
      },
    })

    // APNs alert and aps blocks
    expect(result.message.apns).toEqual({
      payload: {
        aps: {
          alert: {
            title: 'Rich Title',
            subtitle: 'iOS Subtitle',
            body: 'Rich Body',
          },
          badge: 5,
          sound: 'custom.mp3',
          category: 'CATEG_ID',
        },
      },
      fcm_options: {
        image: 'https://example.com/image.png',
      },
    })

    // Webpush link
    expect(result.message.webpush).toEqual({
      fcm_options: {
        link: 'myapp://orders/123',
      },
    })
  })

  it('supports explicit overrides for android, apns, and web', () => {
    const payload = {
      title: 'Title',
      body: 'Body',
      android: {
        channelId: 'custom-chan',
        color: '#ff0000',
        sticky: true,
        ttl: 300,
        clickAction: 'OPEN_ACT',
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            contentAvailable: true,
            mutableContent: true,
            threadId: 'thread-45',
            interruptionLevel: 'critical' as const,
          },
          customKey: 'customVal',
        },
      },
      web: {
        icon: 'https://icon.png',
        tag: 'web-tag',
      },
    }

    const result = buildFcmPayload('fcm-token', payload)

    expect(result.message.android).toEqual({
      priority: 'HIGH',
      ttl: '300s',
      notification: {
        channel_id: 'custom-chan',
        color: '#ff0000',
        sticky: true,
        click_action: 'OPEN_ACT',
      },
    })

    expect(result.message.apns).toEqual({
      headers: { 'apns-priority': '10' },
      payload: {
        customKey: 'customVal',
        aps: {
          'content-available': 1,
          'mutable-content': 1,
          'thread-id': 'thread-45',
          'interruption-level': 'critical',
        },
      },
    })

    expect(result.message.webpush).toEqual({
      notification: {
        icon: 'https://icon.png',
        tag: 'web-tag',
      },
    })
  })
})

describe('buildExpoPushPayload - Rich Mappings', () => {
  it('maps subtitle, sound, badge, categoryIdentifier, and custom data helpers', () => {
    const payload = {
      title: 'Expo Title',
      body: 'Expo Body',
      subtitle: 'Expo Subtitle',
      image: 'https://example.com/img.png',
      sound: 'custom-sound',
      badge: 2,
      categoryIdentifier: 'EXPO_CATEG',
      deepLink: 'myapp://home',
      data: { custom: 'value' },
      android: { channelId: 'expo-channel', priority: 'NORMAL' as const },
    }

    const result = buildExpoPushPayload('ExponentPushToken[abc]', payload)

    expect(result).toEqual({
      to: 'ExponentPushToken[abc]',
      title: 'Expo Title',
      subtitle: 'Expo Subtitle',
      body: 'Expo Body',
      sound: 'custom-sound',
      badge: 2,
      categoryId: 'EXPO_CATEG',
      priority: 'normal',
      channelId: 'expo-channel',
      data: {
        custom: 'value',
        _image: 'https://example.com/img.png',
        url: 'myapp://home',
      },
    })
  })

  it('maps boolean sound triggers correctly', () => {
    const payloadTrue = { title: 'T', body: 'B', sound: true }
    const payloadFalse = { title: 'T', body: 'B', sound: false }

    expect(buildExpoPushPayload('ExponentPushToken[abc]', payloadTrue).sound).toBe('default')
    expect(buildExpoPushPayload('ExponentPushToken[abc]', payloadFalse).sound).toBe(null)
  })
})
