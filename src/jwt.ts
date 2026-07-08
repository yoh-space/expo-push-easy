import type { ServiceAccount } from "./types.js";

function base64Url(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBuf(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export function clearFcmTokenCache(): void {
  tokenCache.clear()
}

export function getFcmTokenCacheSize(): number {
  return tokenCache.size
}

export async function getFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const cacheKey = sa.client_email
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
      .buffer as ArrayBuffer,
  )
  const payload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      }),
    ).buffer as ArrayBuffer,
  )

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuf(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = base64Url(
    await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      new TextEncoder().encode(`${header}.${payload}`),
    ),
  )

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.${signature}`,
    }),
  })
  const data = await res.json()
  if (!data.access_token)
    throw new Error(`OAuth failed: ${JSON.stringify(data)}`)

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: (now + (data.expires_in || 3600) - 60) * 1000,
  })
  return data.access_token;
}
