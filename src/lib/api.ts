import type { CloudNavData, SiteSettings } from "../types";
import { isHttpOrHttpsUrl, normalizeHttpUrl } from "./url";

export type MeResponse = { authed: boolean };

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function jsonFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let details: unknown = undefined;
    try {
      const data = (await res.json()) as { error?: string; details?: unknown };
      if (data?.error) message = data.error;
      if (data?.details) details = data.details;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status, details);
  }

  return (await res.json()) as T;
}

export const api = {
  links: () => jsonFetch<CloudNavData>("/api/links", { method: "GET" }),
  linksNoCache: () => jsonFetch<CloudNavData>("/api/links", { method: "GET", cache: "no-store" }),
  me: () => jsonFetch<MeResponse>("/api/me", { method: "GET", cache: "no-store" }),
  login: (password: string) =>
    jsonFetch<{ ok: true }>("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => jsonFetch<{ ok: true }>("/api/logout", { method: "POST" }),
  save: (data: CloudNavData) =>
    jsonFetch<{ ok: true }>("/api/admin/save", { method: "POST", body: JSON.stringify(data) }),
  admin: {
    fetchTitle: (url: string) =>
      jsonFetch<{ title: string }>("/api/admin/fetch-title", {
        method: "POST",
        body: JSON.stringify({ url })
      }),
    settings: {
      get: () => jsonFetch<{ settings: SiteSettings }>("/api/admin/settings", { method: "GET", cache: "no-store" }),
      update: (patch: Partial<SiteSettings>) =>
        jsonFetch<{ ok: true; settings: SiteSettings }>("/api/admin/settings", {
          method: "PUT",
          body: JSON.stringify(patch)
        })
    },
    groups: {
      create: (name: string) =>
        jsonFetch<{ ok: true; group: CloudNavData["groups"][number] }>("/api/admin/groups", {
          method: "POST",
          body: JSON.stringify({ name })
        }),
      update: (id: string, patch: { name?: string; enabled?: boolean }) =>
        jsonFetch<{ ok: true; group: CloudNavData["groups"][number] }>(`/api/admin/groups/${id}`, {
          method: "PUT",
          body: JSON.stringify(patch)
        }),
      delete: (id: string) =>
        jsonFetch<{ ok: true }>(`/api/admin/groups/${id}`, {
          method: "DELETE"
        })
    },
    links: {
      create: (input: {
        groupId: string;
        sectionId?: string;
        title: string;
        url: string;
        description?: string;
        icon?: string;
      }) =>
        jsonFetch<{ ok: true; link: CloudNavData["links"][number] }>("/api/admin/links", {
          method: "POST",
          body: JSON.stringify({
            ...input,
            sectionId: input.sectionId || undefined,
            url: isHttpOrHttpsUrl(input.url) ? input.url : normalizeHttpUrl(input.url)
          })
        }),
      update: (
        id: string,
        patch: { title?: string; url?: string; description?: string; icon?: string; groupId?: string; sectionId?: string | null }
      ) =>
        jsonFetch<{ ok: true; link: CloudNavData["links"][number] }>(`/api/admin/links/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...patch,
            ...(patch.url ? { url: isHttpOrHttpsUrl(patch.url) ? patch.url : normalizeHttpUrl(patch.url) } : null)
          })
        }),
      delete: (id: string) =>
        jsonFetch<{ ok: true }>(`/api/admin/links/${id}`, {
          method: "DELETE"
        })
    },
    sections: {
      create: (input: { groupId: string; name: string }) =>
        jsonFetch<{ ok: true; section: NonNullable<CloudNavData["sections"]>[number] }>("/api/admin/sections", {
          method: "POST",
          body: JSON.stringify(input)
        }),
      update: (id: string, patch: { name?: string; order?: number }) =>
        jsonFetch<{ ok: true; section: NonNullable<CloudNavData["sections"]>[number] }>(`/api/admin/sections/${id}`, {
          method: "PUT",
          body: JSON.stringify(patch)
        }),
      delete: (id: string) =>
        jsonFetch<{ ok: true }>(`/api/admin/sections/${id}`, {
          method: "DELETE"
        })
    },
    reorder: (body: {
      groups?: { id: string; order: number }[];
      sections?: { id: string; order: number }[];
      links?: { id: string; order: number; groupId?: string; sectionId?: string | null }[];
    }) => jsonFetch<{ ok: true }>("/api/admin/reorder", { method: "POST", body: JSON.stringify(body) })
  }
};
