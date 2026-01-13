import { z } from "zod";
import { defaultSettings, json, loadData, normalizeData, normalizeSettings, requireAuth, saveData } from "../_utils";

const SettingsPatch = z.object({
  siteTitle: z.string().trim().min(1).max(40).optional(),
  siteSubtitle: z.string().trim().min(1).max(60).optional(),
  siteIconDataUrl: z.string().trim().max(360000).optional(),
  faviconDataUrl: z.string().trim().max(360000).optional(),
  siteIconFit: z.enum(["contain", "cover"]).optional()
});

function validateImageRefOrEmpty(v: string) {
  if (!v) return true;
  if (v.startsWith("data:")) return /^data:image\//.test(v);
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  const data = normalizeData(await loadData(env));
  return json({ settings: data.settings ?? defaultSettings }, { headers: { "Cache-Control": "no-store" } });
};

export const onRequestPut: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  let parsed: z.infer<typeof SettingsPatch>;
  try {
    parsed = SettingsPatch.parse(await ctx.request.json());
  } catch (e: unknown) {
    return json(
      { error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = normalizeData(await loadData(env));
  const current = normalizeSettings(data.settings);

  const next = normalizeSettings({
    ...current,
    ...(parsed.siteTitle != null ? { siteTitle: parsed.siteTitle } : null),
    ...(parsed.siteSubtitle != null ? { siteSubtitle: parsed.siteSubtitle } : null),
    ...(parsed.siteIconDataUrl != null ? { siteIconDataUrl: parsed.siteIconDataUrl } : null),
    ...(parsed.faviconDataUrl != null ? { faviconDataUrl: parsed.faviconDataUrl } : null),
    ...(parsed.siteIconFit != null ? { siteIconFit: parsed.siteIconFit } : null)
  });

  if (!validateImageRefOrEmpty(next.siteIconDataUrl)) {
    return json(
      {
        error: "Invalid request body",
        details: [{ path: ["siteIconDataUrl"], message: "Icon must be data:image/... or http/https URL" }]
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!validateImageRefOrEmpty(next.faviconDataUrl)) {
    return json(
      {
        error: "Invalid request body",
        details: [{ path: ["faviconDataUrl"], message: "Favicon must be data:image/... or http/https URL" }]
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  data.settings = next as any;
  await saveData(env, normalizeData(data));
  return json({ ok: true, settings: next }, { headers: { "Cache-Control": "no-store" } });
};
