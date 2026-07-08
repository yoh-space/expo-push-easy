export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PushTokenResult {
  token: string;
  type: 'expo' | 'android' | 'ios';
}

export interface RegisterOptions {
  projectId?: string;           // EAS project ID (required for getExpoPushTokenAsync in SDK 49+)
  useDevicePushToken?: boolean; // Get raw FCM/APNs token instead of Expo token
}

export type LocalNotificationTrigger =
  | null                                        // Immediate
  | { type: 'timeInterval'; seconds: number; repeats?: boolean }
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'calendar'; year?: number; month?: number; day?: number;
      hour?: number; minute?: number; second?: number; repeats?: boolean };

export interface ScheduleLocalOptions {
  title: string;
  body: string;
  subtitle?: string;
  sound?: string | boolean;
  badge?: number;
  data?: Record<string, unknown>;
  categoryIdentifier?: string;
  trigger: LocalNotificationTrigger;
}
