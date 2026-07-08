import type { PushPayload } from './types';

export function buildFcmPayload(token: string, p: PushPayload) {
    const message: any = {
        token,
        notification: {
            title: p.title,
            body: p.body,
        },
    };
    if (p.data) message.data = p.data
    if (p.android) {
        message.android = { priority: p.android?.priority ||'HIGH' };
        if (p.android.channelId) {
            message.android.notification = { channelId: p.android.channelId };
        }
    }
    return {message};
}