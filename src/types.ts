export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
    android?: {
        channelId?: string;
        priority?: 'HIGH' | 'NORMAL';
    }
}

export interface PushResult {
    success: boolean;
    provider: 'fcm' | 'expo-push';
    status?: number;
    error?: string;
    fcmMessageId?: string;
}

export interface ServiceAccount {
    project_id: string;
    client_email: string;
    private_key: string;
}