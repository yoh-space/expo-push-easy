import * as Notifications from 'expo-notifications';
import type { PermissionStatus } from './types.js';

export async function getPushPermissionStatus(): Promise<PermissionStatus> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  } catch (e) {
    return 'undetermined';
  }
}

export async function requestPushPermissions(): Promise<PermissionStatus> {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    return settings.status;
  } catch (e) {
    return 'denied';
  }
}
