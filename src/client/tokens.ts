import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PushTokenResult, RegisterOptions } from './types.js';
import { requestPushPermissions } from './permissions.js';

export async function registerForPushNotifications(options?: RegisterOptions): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    throw new Error('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const status = await requestPushPermissions();
  if (status !== 'granted') {
    throw new Error(`Push notification permission not granted (status: ${status})`);
  }

  if (options?.useDevicePushToken) {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    return {
      token: deviceToken.data,
      type: Platform.OS === 'ios' ? 'ios' : 'android',
    };
  } else {
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: options?.projectId,
    });
    return {
      token: expoToken.data,
      type: 'expo',
    };
  }
}

export function onTokenRefresh(callback: (token: PushTokenResult) => void): () => void {
  const subscription = Notifications.addPushTokenListener((pushToken: any) => {
    // Map token type safely
    let type: 'expo' | 'android' | 'ios' = 'expo';
    if (pushToken.type === 'ios') type = 'ios';
    if (pushToken.type === 'android') type = 'android';
    
    callback({
      token: pushToken.data,
      type,
    });
  });
  return () => subscription.remove();
}
