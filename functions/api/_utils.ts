type Env = {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD: string;
  SESSION_SECRET?: string;
  USE_FAVICON_SERVICE?: string;
};

export type SiteSettings = {
  siteTitle: string;
  siteSubtitle: string;
  siteIconDataUrl: string;
  faviconDataUrl: string;
  siteIconFit: "contain" | "cover";
};

export type CloudNavData = {
  settings?: SiteSettings;
  groups: { id: string; name: string; order: number; enabled?: boolean }[];
  links: {
    id: string;
    groupId: string;
    title: string;
    url: string;
    icon?: string;
    description?: string;
    order: number;
  }[];
};

export const DATA_KEY = "cloudnav:data";
export const LOGIN_FAIL_KEY_PREFIX = "cloudnav:login-fails:";
export const SESSION_COOKIE = "cloudnav_session";
export const SESSION_DAYS = 7;

export const defaultSettings: SiteSettings = {
  siteTitle: "AppleBar",
  siteSubtitle: "个人导航",
  siteIconDataUrl: "",
  faviconDataUrl: "",
  siteIconFit: "contain"
};

export const defaultSeedData: CloudNavData = {
  settings: defaultSettings,
  groups: [
    { id: "g-dev", name: "开发", order: 0, enabled: true },
    { id: "g-life", name: "日常", order: 1, enabled: true },
    { id: "g-ref", name: "参考", order: 2, enabled: true }
  ],
  links: [
    {
      id: "l-cf",
      groupId: "g-dev",
      title: "Cloudflare Docs",
      url: "https://developers.cloudflare.com/",
      description: "Pages / Functions / Workers KV 官方文档",
      order: 0
    },
    {
      id: "l-vite",
      groupId: "g-dev",
      title: "Vite",
      url: "https://vitejs.dev/",
      description: "快速、现代的前端构建工具",
      order: 1
    },
    {
      id: "l-react",
      groupId: "g-ref",
      title: "React",
      url: "https://react.dev/",
      description: "UI 库与最佳实践",
      order: 0
    }
  ]
};

export function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readBodyJson<T>(req: Request): Promise<T> {
  const ct = req.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) throw new Error("Expected application/json");
  return (await req.json()) as T;
}

export function cookieGet(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie");
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 0) continue;
    const k = p.slice(0, i);
    const v = p.slice(i + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

export function cookieSerialize({
  name,
  value,
  maxAge,
  expires,
  httpOnly = true,
  sameSite = "Lax",
  path = "/",
  secure
}: {
  name: string;
  value: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  secure?: boolean;
}) {
  const chunks = [`${name}=${encodeURIComponent(value)}`];
  chunks.push(`Path=${path}`);
  chunks.push(`SameSite=${sameSite}`);
  if (httpOnly) chunks.push("HttpOnly");
  if (typeof maxAge === "number") chunks.push(`Max-Age=${Math.floor(maxAge)}`);
  if (expires) chunks.push(`Expires=${expires.toUTCString()}`);
  if (secure) chunks.push("Secure");
  return chunks.join("; ");
}

export function isSecureRequest(req: Request) {
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function base64UrlEncode(bytes: ArrayBuffer) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (const b of arr) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKeyFromSecret(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secret);
  return crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function deriveSecretFromPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const bytes = enc.encode(`cloudnav:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(digest);
}

type SessionPayload = { sub: "admin"; iat: number; exp: number };

export async function getSessionSecret(env: Env): Promise<string> {
  if (env.SESSION_SECRET && env.SESSION_SECRET.trim()) return env.SESSION_SECRET.trim();
  return await deriveSecretFromPassword(env.PASSWORD);
}

export async function signSession(payload: SessionPayload, secret: string) {
  const raw = JSON.stringify(payload);
  const key = await hmacKeyFromSecret(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return `${base64UrlEncode(new TextEncoder().encode(raw))}.${base64UrlEncode(sig)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const i = token.indexOf(".");
  if (i < 0) return null;
  const payloadPart = token.slice(0, i);
  const sigPart = token.slice(i + 1);
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = base64UrlDecodeToBytes(payloadPart);
    sigBytes = base64UrlDecodeToBytes(sigPart);
  } catch {
    return null;
  }
  const key = await hmacKeyFromSecret(secret);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  if (!timingSafeEqual(sigBytes, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.sub !== "admin") return null;
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.iat !== "number" || payload.iat > now + 30) return null;
  return payload;
}

export async function requireAuthed(req: Request, env: Env): Promise<{ ok: true } | { ok: false; res: Response }> {
  const token = cookieGet(req, SESSION_COOKIE);
  if (!token) return { ok: false, res: json({ error: "Unauthorized" }, { status: 401 }) };
  const secret = await getSessionSecret(env);
  const payload = await verifySession(token, secret);
  if (!payload) {
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      cookieSerialize({ name: SESSION_COOKIE, value: "", maxAge: 0, httpOnly: true, secure: isSecureRequest(req) })
    );
    return { ok: false, res: json({ error: "Unauthorized" }, { status: 401, headers }) };
  }
  return { ok: true };
}

export async function requireAuth(req: Request, env: Env) {
  return requireAuthed(req, env);
}

export async function loadData(env: Env): Promise<CloudNavData> {
  const existing = await env.CLOUDNAV_KV.get(DATA_KEY, "json");
  if (!existing) return defaultSeedData;
  return existing as CloudNavData;
}

export async function saveData(env: Env, data: CloudNavData) {
  await env.CLOUDNAV_KV.put(DATA_KEY, JSON.stringify(data));
}

export function normalizeSettings(input: CloudNavData["settings"]): SiteSettings {
  const s: any = input ?? {};
  const out: SiteSettings = {
    siteTitle: typeof s.siteTitle === "string" ? s.siteTitle.trim() : defaultSettings.siteTitle,
    siteSubtitle: typeof s.siteSubtitle === "string" ? s.siteSubtitle.trim() : defaultSettings.siteSubtitle,
    siteIconDataUrl:
      typeof s.siteIconDataUrl === "string"
        ? s.siteIconDataUrl.trim()
        : typeof s.siteIcon === "string"
          ? s.siteIcon.trim()
          : defaultSettings.siteIconDataUrl,
    faviconDataUrl:
      typeof s.faviconDataUrl === "string"
        ? s.faviconDataUrl.trim()
        : typeof s.favicon === "string"
          ? s.favicon.trim()
          : defaultSettings.faviconDataUrl,
    siteIconFit: s.siteIconFit === "cover" ? "cover" : "contain"
  };

  if (!out.siteTitle) out.siteTitle = defaultSettings.siteTitle;
  if (!out.siteSubtitle) out.siteSubtitle = defaultSettings.siteSubtitle;
  return out;
}

export function normalizeData(data: CloudNavData): CloudNavData {
  const settings = normalizeSettings(data.settings);
  const groups = data.groups.slice().sort((a, b) => a.order - b.order);
  for (let i = 0; i < groups.length; i++)
    groups[i] = { ...groups[i], order: i, enabled: typeof groups[i].enabled === "boolean" ? groups[i].enabled : true };

  const groupIds = new Set(groups.map((g) => g.id));
  const keptLinks = data.links.filter((l) => groupIds.has(l.groupId));

  const byGroup = new Map<string, typeof keptLinks>();
  for (const l of keptLinks) {
    const arr = byGroup.get(l.groupId) ?? [];
    arr.push(l);
    byGroup.set(l.groupId, arr);
  }

  const links: CloudNavData["links"] = [];
  for (const g of groups) {
    const arr = (byGroup.get(g.id) ?? []).slice().sort((a, b) => a.order - b.order);
    for (let i = 0; i < arr.length; i++) links.push({ ...arr[i], order: i });
  }

  return { settings, groups, links };
}

export function getClientIp(req: Request) {
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Real-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
