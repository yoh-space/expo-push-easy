import * as Notifications from 'expo-notifications';
import type { ScheduleLocalOptions, LocalNotificationTrigger } from './types.js';

function mapTrigger(trigger: LocalNotificationTrigger): any {
  if (trigger === null) return null;
  switch (trigger.type) {
    case 'timeInterval':
      return {
        type: 'timeInterval',
        seconds: trigger.seconds,
        repeats: trigger.repeats ?? false,
      };
    case 'daily':
      return {
        type: 'daily',
        hour: trigger.hour,
        minute: trigger.minute,
        repeats: true,
      };
    case 'weekly':
      return {
        type: 'weekly',
        weekday: trigger.weekday,
        hour: trigger.hour,
        minute: trigger.minute,
        repeats: true,
      };
    case 'calendar':
      return {
        type: 'calendar',
        year: trigger.year,
        month: trigger.month,
        day: trigger.day,
        hour: trigger.hour,
        minute: trigger.minute,
        second: trigger.second,
        repeats: trigger.repeats ?? false,
      };
    default:
      return null;
  }
}

export async function scheduleLocalNotification(options: ScheduleLocalOptions): Promise<string> {
  const content: any = {
    title: options.title,
    body: options.body,
  };

  if (options.subtitle) content.subtitle = options.subtitle;
  if (options.badge !== undefined) content.badge = options.badge;
  if (options.data) content.data = options.data;
  if (options.categoryIdentifier) content.categoryIdentifier = options.categoryIdentifier;

  if (options.sound !== undefined) {
    if (options.sound === true) {
      content.sound = 'default';
    } else if (options.sound === false || options.sound === null) {
      content.sound = null;
    } else {
      content.sound = options.sound;
    }
  }

  return await Notifications.scheduleNotificationAsync({
    content,
    trigger: mapTrigger(options.trigger),
  });
}

export async function cancelScheduledNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
