import { json, loadData, normalizeData } from "./_utils";

export const onRequestGet: PagesFunction = async (ctx) => {
  const data = normalizeData(await loadData(ctx.env as any));
  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400"
    }
  });
};
