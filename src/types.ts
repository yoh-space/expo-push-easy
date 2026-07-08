export interface PushPayload {
  title: string;
  body: string;
  subtitle?: string;                    // iOS subtitle
  image?: string;                       // Image URL (cross-platform)
  sound?: string | boolean;             // Sound name, or true for 'default'
  badge?: number;                       // Badge count (iOS + Android)
  data?: Record<string, unknown>;       // WIDENED from Record<string, string>
  categoryIdentifier?: string;          // Interactive notification category
  deepLink?: string;                    // Deep link / URL for navigation

  android?: {
    channelId?: string;
    priority?: 'HIGH' | 'NORMAL';
    color?: string;                     // Icon color (#RRGGBB)
    tag?: string;                       // Replaces notification with same tag
    sticky?: boolean;                   // Non-dismissible
    ttl?: number;                       // Time-to-live in seconds
    icon?: string;                      // Drawable resource name
    clickAction?: string;               // Activity to open on tap
    collapseKey?: string;               // Collapse key for grouping
    visibility?: 'PUBLIC' | 'PRIVATE' | 'SECRET';
  };

  apns?: {
    headers?: Record<string, string>;   // APNs HTTP/2 headers
    payload?: {
      aps?: {
        badge?: number;
        sound?: string | { critical?: number; name?: string; volume?: number };
        contentAvailable?: boolean;     // Silent/background push
        mutableContent?: boolean;       // Rich media (Notification Service Extension)
        category?: string;
        threadId?: string;              // Notification grouping
        interruptionLevel?: 'passive' | 'active' | 'time-sensitive' | 'critical';
        relevanceScore?: number;
      };
      [key: string]: unknown;           // Custom keys for extensions
    };
  };

  web?: {
    icon?: string;
    image?: string;
    actions?: Array<{ action: string; title: string }>;
    badge?: string;
    requireInteraction?: boolean;
    tag?: string;
    link?: string;
  };
}

export interface PushResult {
  success: boolean;
  provider: 'fcm' | 'expo-push';
  status?: number;
  error?: string;
  errorCode?: string;                   // e.g. 'UNREGISTERED', 'INVALID_ARGUMENT'
  fcmMessageId?: string;
  expoPushTicketId?: string;            // Expo Push ticket ID for receipt checking
  token?: string;                       // The token this result is for
}

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}