import * as Notifications from 'expo-notifications';
import type { PermissionStatus } from './types.js';

function mapPermissionStatus(settings: unknown): PermissionStatus {
  const permission = settings as { granted?: boolean; canAskAgain?: boolean };

  if (permission.granted) {
    return 'granted';
  }

  return permission.canAskAgain ? 'undetermined' : 'denied';
}

export async function getPushPermissionStatus(): Promise<PermissionStatus> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return mapPermissionStatus(settings);
  } catch (e) {
    return 'undetermined';
  }
}

export async function requestPushPermissions(): Promise<PermissionStatus> {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    return mapPermissionStatus(settings);
  } catch (e) {
    return 'denied';
  }
}
