import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../components/Card";
import { Navbar } from "../components/Navbar";
import { SidebarCategoryPicker } from "../components/SidebarCategoryPicker";
import { SearchBar } from "../components/SearchBar";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";
import { faviconServiceUrl, normalizeFaviconUrl } from "../lib/favicon";
import { applyFavicon } from "../lib/siteSettings";
import type { CloudNavData, Group, LinkItem } from "../types";

function normalizeText(s: string) {
  return s.trim().toLowerCase();
}

function matchesQuery(link: LinkItem, query: string) {
  const q = normalizeText(query);
  if (!q) return true;
  const hay = `${link.title} ${link.description ?? ""} ${link.url}`.toLowerCase();
  return hay.includes(q);
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { authed } = useMe();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<CloudNavData | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    api
      .links()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  useEffect(() => {
    applyFavicon(data?.settings?.faviconDataUrl);
  }, [data?.settings?.faviconDataUrl]);

  const groups = useMemo(() => {
    const g = (data?.groups ?? [])
      .filter((x) => x.enabled ?? true)
      .slice()
      .sort((a, b) => a.order - b.order);
    return g;
  }, [data]);

  const enabledGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const allLinks = useMemo(() => {
    return (data?.links ?? []).filter((l) => enabledGroupIds.has(l.groupId)).slice().sort((a, b) => a.order - b.order);
  }, [data, enabledGroupIds]);

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId(null);
      return;
    }

    const fromQuery = params.get("group");
    if (fromQuery === "__all__" || (fromQuery && groups.some((g) => g.id === fromQuery))) {
      setSelectedGroupId(fromQuery);
      return;
    }

    setSelectedGroupId((prev) => (prev && groups.some((g) => g.id === prev) ? prev : groups[0]!.id));
  }, [groups, params]);

  const isAll = selectedGroupId === "__all__";

  const selectedGroup: Group | null = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId]
  );

  const sidebarGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of allLinks) counts.set(l.groupId, (counts.get(l.groupId) ?? 0) + 1);
    return [
      { id: "__all__", name: "全部", count: allLinks.length },
      ...groups.map((g) => ({ id: g.id, name: g.name, count: counts.get(g.id) ?? 0 }))
    ];
  }, [allLinks, groups]);

  const linksInSelectedGroupAll = useMemo(() => {
    if (!selectedGroup) return [];
    return (data?.links ?? [])
      .filter((l) => l.groupId === selectedGroup.id)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [data, selectedGroup]);

  const filteredLinks = useMemo(() => {
    if (!selectedGroup) return [];
    return linksInSelectedGroupAll.filter((l) => matchesQuery(l, query));
  }, [linksInSelectedGroupAll, selectedGroup, query]);

  const linksByGroupAll = useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    for (const l of allLinks) {
      if (!matchesQuery(l, query)) continue;
      const arr = map.get(l.groupId) ?? [];
      arr.push(l);
      map.set(l.groupId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [allLinks, query]);

  const visibleGroupsAll: Group[] = useMemo(() => {
    if (!query) return groups;
    return groups.filter((g) => (linksByGroupAll.get(g.id)?.length ?? 0) > 0);
  }, [groups, linksByGroupAll, query]);

  return (
    <div className="app-bg">
      <Navbar authed={authed === true} settings={data?.settings} />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.18 } : { type: "spring", stiffness: 420, damping: 34 }}
          className="space-y-6"
        >
          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight">导航</div>
            <div className="text-sm text-muted">轻盈、克制、随手可用。</div>
          </div>

          {error ? <div className="glass rounded-2xl p-4 text-sm text-danger">{error}</div> : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <aside className="lg:col-span-3">
              <SidebarCategoryPicker
                groups={sidebarGroups}
                selectedId={selectedGroupId}
                onSelect={(id) => {
                  setSelectedGroupId(id);
                  setParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      next.set("group", id);
                      return next;
                    },
                    { replace: true }
                  );
                }}
                rowHeight={42}
              />
            </aside>

            <section className="space-y-3 lg:col-span-9">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-fg/90">{isAll ? "全部" : selectedGroup?.name ?? "—"}</div>
                  <div className="text-xs text-muted">{isAll ? allLinks.filter((l) => matchesQuery(l, query)).length : filteredLinks.length} 项</div>
                </div>
                <div className="w-full sm:w-[360px]">
                  <SearchBar value={query} onChange={setQuery} />
                </div>
              </div>

              {isAll ? (
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key="__all__"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
                    className="space-y-4"
                  >
                    {visibleGroupsAll.map((g) => {
                      const links = linksByGroupAll.get(g.id) ?? [];
                      return (
                        <motion.section key={g.id} layout className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-fg/90">{g.name}</div>
                            <div className="text-xs text-muted">{links.length} 项</div>
                          </div>
                          <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {links.map((l) => (
                              <Card key={l.id} as="a" href={l.url} target="_blank" rel="noreferrer" className="p-4">
                                <div className="flex items-start gap-3">
                                  <LinkIcon url={l.url} icon={l.icon} reduceMotion={!!reduceMotion} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="truncate text-sm font-semibold">{l.title}</div>
                                    </div>
                                    {l.description ? (
                                      <div className="mt-1 line-clamp-2 text-xs text-muted">{l.description}</div>
                                    ) : (
                                      <div className="mt-1 truncate text-xs text-muted">{safeHostname(l.url)}</div>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </motion.div>
                        </motion.section>
                      );
                    })}
                    {!visibleGroupsAll.length ? (
                      <div className="glass rounded-2xl p-6 text-sm text-muted">没有匹配的链接。</div>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={selectedGroup?.id ?? "empty"}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {filteredLinks.map((l) => (
                        <Card key={l.id} as="a" href={l.url} target="_blank" rel="noreferrer" className="p-4">
                          <div className="flex items-start gap-3">
                            <LinkIcon url={l.url} icon={l.icon} reduceMotion={!!reduceMotion} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="truncate text-sm font-semibold">{l.title}</div>
                              </div>
                              {l.description ? (
                                <div className="mt-1 line-clamp-2 text-xs text-muted">{l.description}</div>
                              ) : (
                                <div className="mt-1 truncate text-xs text-muted">{safeHostname(l.url)}</div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </motion.div>
                  </AnimatePresence>

                  {selectedGroup && !filteredLinks.length ? (
                    <div className="glass rounded-2xl p-6 text-sm text-muted">这个分类里还没有匹配的链接。</div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function LinkIcon({ url, icon, reduceMotion }: { url: string; icon?: string; reduceMotion: boolean }) {
  const [fallback, setFallback] = useState(false);
  const primary = icon?.trim() ? icon.trim() : normalizeFaviconUrl(url);
  const src = fallback ? faviconServiceUrl(url) : primary;

  return (
    <motion.div
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 dark:bg-white/6"
      whileHover={reduceMotion ? undefined : { rotate: -2, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
    >
      {src ? (
        <img src={src} alt="" className="h-6 w-6 rounded-md" loading="lazy" onError={() => setFallback(true)} />
      ) : (
        <Globe size={18} className="text-fg/80" />
      )}
    </motion.div>
  );
}
