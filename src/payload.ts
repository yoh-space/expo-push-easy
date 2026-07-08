import type { PushPayload } from './types.js'

export function buildFcmPayload(token: string, p: PushPayload): { message: Record<string, unknown> } {
  const message: Record<string, unknown> = {
    token,
    notification: { title: p.title, body: p.body },
  }

  if (p.image) {
    ;(message.notification as Record<string, string>).image = p.image
  }

  // FCM data block requires all values to be strings
  const dataRecord: Record<string, string> = {}
  if (p.data) {
    for (const [key, val] of Object.entries(p.data)) {
      if (val !== undefined && val !== null) {
        dataRecord[key] = typeof val === 'object' ? JSON.stringify(val) : String(val)
      }
    }
  }
  if (p.deepLink) {
    dataRecord._deepLink = p.deepLink
  }
  if (Object.keys(dataRecord).length > 0) {
    message.data = dataRecord
  }

  // Android Overrides
  const androidNotif: Record<string, unknown> = {}
  if (p.android?.channelId) androidNotif.channel_id = p.android.channelId
  if (p.android?.color) androidNotif.color = p.android.color
  if (p.android?.tag) androidNotif.tag = p.android.tag
  if (p.android?.sticky !== undefined) androidNotif.sticky = p.android.sticky
  if (p.android?.icon) androidNotif.icon = p.android.icon
  if (p.android?.clickAction) androidNotif.click_action = p.android.clickAction
  if (p.android?.visibility) androidNotif.visibility = p.android.visibility

  if (p.sound !== undefined) {
    if (p.sound === true) {
      androidNotif.sound = 'default'
    } else if (p.sound !== false && p.sound !== null) {
      androidNotif.sound = p.sound
    }
  }
  if (p.badge !== undefined) {
    androidNotif.notification_count = p.badge
  }

  const hasAndroidConfig = p.android !== undefined || Object.keys(androidNotif).length > 0
  if (hasAndroidConfig) {
    const androidBlock: Record<string, unknown> = {}
    androidBlock.priority = p.android?.priority || 'HIGH'
    if (p.android?.collapseKey) {
      androidBlock.collapse_key = p.android.collapseKey
    }
    if (p.android?.ttl !== undefined) {
      androidBlock.ttl = `${p.android.ttl}s`
    }
    if (Object.keys(androidNotif).length > 0) {
      androidBlock.notification = androidNotif
    }
    message.android = androidBlock
  }

  // APNs Overrides
  const apnsBlock: Record<string, unknown> = {}
  if (p.apns?.headers) {
    apnsBlock.headers = p.apns.headers
  }

  const apsBlock: Record<string, unknown> = {}
  if (p.subtitle) {
    apsBlock.alert = {
      title: p.title,
      subtitle: p.subtitle,
      body: p.body,
    }
  }

  if (p.badge !== undefined) {
    apsBlock.badge = p.badge
  }
  if (p.sound !== undefined) {
    if (p.sound === true) {
      apsBlock.sound = 'default'
    } else if (p.sound !== false && p.sound !== null) {
      apsBlock.sound = p.sound
    }
  }
  if (p.categoryIdentifier) {
    apsBlock.category = p.categoryIdentifier
  }

  if (p.apns?.payload) {
    const { aps, ...customPayload } = p.apns.payload
    const mergedAps = { ...apsBlock, ...aps }
    const finalAps: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(mergedAps)) {
      if (k === 'contentAvailable') finalAps['content-available'] = v ? 1 : 0
      else if (k === 'mutableContent') finalAps['mutable-content'] = v ? 1 : 0
      else if (k === 'threadId') finalAps['thread-id'] = v
      else if (k === 'interruptionLevel') finalAps['interruption-level'] = v
      else if (k === 'relevanceScore') finalAps['relevance-score'] = v
      else finalAps[k] = v
    }
    apnsBlock.payload = { ...customPayload, aps: finalAps }
  } else if (Object.keys(apsBlock).length > 0) {
    const finalAps: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(apsBlock)) {
      if (k === 'contentAvailable') finalAps['content-available'] = v ? 1 : 0
      else if (k === 'mutableContent') finalAps['mutable-content'] = v ? 1 : 0
      else if (k === 'threadId') finalAps['thread-id'] = v
      else if (k === 'interruptionLevel') finalAps['interruption-level'] = v
      else if (k === 'relevanceScore') finalAps['relevance-score'] = v
      else finalAps[k] = v
    }
    apnsBlock.payload = { aps: finalAps }
  }

  if (p.image) {
    if (!apnsBlock.fcm_options) apnsBlock.fcm_options = {}
    ;(apnsBlock.fcm_options as Record<string, unknown>).image = p.image
  }

  if (Object.keys(apnsBlock).length > 0) {
    message.apns = apnsBlock
  }

  // Webpush Overrides
  const webpushBlock: Record<string, unknown> = {}
  const webNotif: Record<string, unknown> = {}
  if (p.web?.icon) webNotif.icon = p.web.icon
  if (p.web?.image) webNotif.image = p.web.image
  if (p.web?.actions) webNotif.actions = p.web.actions
  if (p.web?.badge) webNotif.badge = p.web.badge
  if (p.web?.requireInteraction !== undefined) webNotif.requireInteraction = p.web.requireInteraction
  if (p.web?.tag) webNotif.tag = p.web.tag

  if (Object.keys(webNotif).length > 0) {
    webpushBlock.notification = webNotif
  }
  if (p.web?.link || p.deepLink) {
    webpushBlock.fcm_options = {
      link: p.web?.link || p.deepLink,
    }
  }
  if (Object.keys(webpushBlock).length > 0) {
    message.webpush = webpushBlock
  }

  return { message }
}

export function buildExpoPushPayload(token: string, p: PushPayload): Record<string, unknown> {
  const data = { ...p.data }
  if (p.image) data._image = p.image
  if (p.deepLink) data.url = p.deepLink

  const payload: Record<string, unknown> = {
    to: token,
    title: p.title,
    body: p.body,
    data,
    priority: p.android?.priority?.toLowerCase() || 'high',
    channelId: p.android?.channelId || 'default',
  }

  if (p.subtitle) payload.subtitle = p.subtitle
  if (p.badge !== undefined) payload.badge = p.badge
  if (p.categoryIdentifier) payload.categoryId = p.categoryIdentifier

  if (p.sound !== undefined) {
    if (p.sound === true) {
      payload.sound = 'default'
    } else if (p.sound === false || p.sound === null) {
      payload.sound = null
    } else {
      payload.sound = p.sound
    }
  } else {
    payload.sound = 'default'
  }

  return payload;
}