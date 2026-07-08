import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Notifications from 'expo-notifications'

// Mock Expo and React Native packages before importing client modules
vi.mock('expo-device', () => ({
  isDevice: true,
}))

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}))

vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  getDevicePushTokenAsync: vi.fn(),
  addPushTokenListener: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { MAX: 4 },
}))

// Import after mocking
import {
  getPushPermissionStatus,
  requestPushPermissions,
  registerForPushNotifications,
  onTokenRefresh,
  scheduleLocalNotification,
  cancelScheduledNotification,
} from '../src/client/index.js'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Client - Permissions', () => {
  it('wraps getPermissionsAsync', async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: false } as any)
    const status = await getPushPermissionStatus()
    expect(status).toBe('granted')
    expect(Notifications.getPermissionsAsync).toHaveBeenCalled()
  })

  it('wraps requestPermissionsAsync', async () => {
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: false } as any)
    const status = await requestPushPermissions()
    expect(status).toBe('denied')
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
  })
})

describe('Client - Registration', () => {
  it('registers for Expo push token successfully', async () => {
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: false } as any)
    vi.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExponentPushToken[mock]' } as any)

    const result = await registerForPushNotifications({ projectId: 'test-project' })
    expect(result).toEqual({
      token: 'ExponentPushToken[mock]',
      type: 'expo',
    })
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project',
    })
  })

  it('registers for native Device token successfully', async () => {
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: false } as any)
    vi.mocked(Notifications.getDevicePushTokenAsync).mockResolvedValue({ data: 'raw-apns-token' } as any)

    const result = await registerForPushNotifications({ useDevicePushToken: true })
    expect(result).toEqual({
      token: 'raw-apns-token',
      type: 'ios',
    })
  })

  it('listens to token refresh events', () => {
    const mockSubscription = { remove: vi.fn() }
    vi.mocked(Notifications.addPushTokenListener).mockReturnValue(mockSubscription as any)

    const callback = vi.fn()
    const unsubscribe = onTokenRefresh(callback)

    expect(Notifications.addPushTokenListener).toHaveBeenCalled()

    const listenerCallback = vi.mocked(Notifications.addPushTokenListener).mock.calls[0][0]
    listenerCallback({ type: 'ios', data: 'new-token' } as any)

    expect(callback).toHaveBeenCalledWith({
      token: 'new-token',
      type: 'ios',
    })

    unsubscribe()
    expect(mockSubscription.remove).toHaveBeenCalled()
  })
})

describe('Client - Scheduling', () => {
  it('schedules local notification with mapped triggers', async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue('notif-id-123')

    const id = await scheduleLocalNotification({
      title: 'Local',
      body: 'Body',
      trigger: { type: 'timeInterval', seconds: 10, repeats: true },
    })

    expect(id).toBe('notif-id-123')
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Local', body: 'Body' },
      trigger: { type: 'timeInterval', seconds: 10, repeats: true },
    })
  })

  it('cancels scheduled notification', async () => {
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockResolvedValue(undefined as any)
    await cancelScheduledNotification('id-123')
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-123')
  })
})
