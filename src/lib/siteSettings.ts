import type { SiteSettings } from "../types";

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteTitle: "AppleBar",
  siteSubtitle: "个人导航",
  siteIconDataUrl: "",
  faviconDataUrl: "",
  siteIconFit: "contain"
};

export function normalizeSiteSettings(input?: Partial<SiteSettings> | null): SiteSettings {
  const s: any = input ?? {};
  const out: SiteSettings = {
    siteTitle: typeof s.siteTitle === "string" ? s.siteTitle.trim() : DEFAULT_SITE_SETTINGS.siteTitle,
    siteSubtitle: typeof s.siteSubtitle === "string" ? s.siteSubtitle.trim() : DEFAULT_SITE_SETTINGS.siteSubtitle,
    siteIconDataUrl:
      typeof s.siteIconDataUrl === "string"
        ? s.siteIconDataUrl.trim()
        : typeof s.siteIcon === "string"
          ? s.siteIcon.trim()
          : DEFAULT_SITE_SETTINGS.siteIconDataUrl,
    faviconDataUrl:
      typeof s.faviconDataUrl === "string"
        ? s.faviconDataUrl.trim()
        : typeof s.favicon === "string"
          ? s.favicon.trim()
          : DEFAULT_SITE_SETTINGS.faviconDataUrl,
    siteIconFit: s.siteIconFit === "cover" ? "cover" : "contain"
  };
  if (!out.siteTitle) out.siteTitle = DEFAULT_SITE_SETTINGS.siteTitle;
  if (!out.siteSubtitle) out.siteSubtitle = DEFAULT_SITE_SETTINGS.siteSubtitle;
  return out;
}

function faviconTypeFromHref(href: string): string | undefined {
  const h = href.trim();
  if (!h) return undefined;
  if (h.startsWith("data:")) {
    const m = /^data:([^;,]+)[;,]/.exec(h);
    return m?.[1];
  }
  const lower = h.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

let capturedOriginalFavicon: { href: string; type?: string } | null = null;

function captureOriginalFavicon() {
  if (capturedOriginalFavicon) return;
  const el = document.head.querySelector('link[rel~="icon"]:not(#cloudnav-favicon)') as HTMLLinkElement | null;
  if (!el) {
    capturedOriginalFavicon = { href: "/favicon.ico" };
    return;
  }
  capturedOriginalFavicon = { href: el.href || el.getAttribute("href") || "/favicon.ico", type: el.type || undefined };
}

export function applyFavicon(href?: string) {
  const next = (href ?? "").trim();
  const head = document.head;
  const id = "cloudnav-favicon";
  captureOriginalFavicon();

  // Clean up any legacy dynamic favicon links (older versions might have set rel=icon to a data URL without our id).
  const allIcons = Array.from(head.querySelectorAll('link[rel~="icon"]')) as HTMLLinkElement[];
  for (const l of allIcons) {
    if (l.id === id) continue;
    const h = (l.getAttribute("href") || l.href || "").trim();
    if (h.startsWith("data:image/")) l.remove();
  }

  const managed = head.querySelector(`#${id}`) as HTMLLinkElement | null;

  if (!next) {
    managed?.remove();

    // Restore original (or a sane default) so DevTools doesn't show a stale data URL favicon.
    const original = capturedOriginalFavicon?.href || "/favicon.ico";
    const keep = head.querySelector('link[rel~="icon"]') as HTMLLinkElement | null;
    if (keep) {
      keep.href = original;
      if (capturedOriginalFavicon?.type) keep.type = capturedOriginalFavicon.type;
      else keep.removeAttribute("type");
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = original;
      if (capturedOriginalFavicon?.type) link.type = capturedOriginalFavicon.type;
      head.appendChild(link);
    }
    return;
  }

  const link = managed ?? document.createElement("link");
  link.id = id;
  link.rel = "icon";
  link.href = next;
  const type = faviconTypeFromHref(next);
  if (type) link.type = type;
  if (!managed) head.appendChild(link);
}
