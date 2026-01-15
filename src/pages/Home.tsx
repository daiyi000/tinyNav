import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { MobileSearchFAB } from "../components/MobileSearchFAB";
import { Navbar } from "../components/Navbar";
import { SidebarCategoryPicker } from "../components/SidebarCategoryPicker";
import { SearchBar } from "../components/SearchBar";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";
import { faviconServiceUrl, normalizeFaviconUrl } from "../lib/favicon";
import { applyFavicon, normalizeSiteSettings } from "../lib/siteSettings";
import type { CloudNavData, Group, LinkItem, Section } from "../types";

const DEFAULT_SECTION_ID = "__default__";
// Mobile header layout (below Navbar/AppBar)
const APPBAR_H = 64; // px (visual height of the AppBar region)
const GAP = 36; // px (space between AppBar and mobile header)
const MOBILE_CAT_H = 56; // px (visual height of the mobile category bar)

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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    try {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    } catch {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, [query]);
  return matches;
}

function MobileCategoryBar({
  items,
  selectedId,
  onSelect
}: {
  items: { id: string; name: string; count: number }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="glass rounded-2xl border border-white/10 bg-white/10 px-2 py-2 shadow-soft dark:bg-white/6 dark:shadow-softDark">
      <div className="relative flex gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((g) => {
          const selected = g.id === selectedId;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g.id)}
              className={
                "relative inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm font-medium transition-colors " +
                (selected ? "text-fg" : "text-fg/80 hover:text-fg hover:bg-white/8 dark:hover:bg-white/10")
              }
            >
              {selected ? (
                <motion.div
                  layoutId="mobileCatSlider"
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-white/40 bg-white/30 ring-1 ring-black/5 backdrop-blur-md dark:border-white/12 dark:bg-white/8 dark:ring-0"
                  style={{ pointerEvents: "none" }}
                  transition={{ type: "spring", stiffness: 650, damping: 48, mass: 0.8 }}
                />
              ) : null}
              <span className="relative z-10 max-w-[14ch] truncate">{g.name}</span>
              <span
                className={
                  "relative z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs " +
                  (selected ? "bg-black/8 text-fg/80 dark:bg-white/10" : "bg-black/5 text-muted dark:bg-white/8")
                }
              >
                {g.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { authed } = useMe();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [data, setData] = useState<CloudNavData | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  useEffect(() => {
    api
      .links()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  useEffect(() => {
    applyFavicon(data?.settings?.faviconDataUrl);
  }, [data?.settings?.faviconDataUrl]);

  const site = useMemo(() => normalizeSiteSettings(data?.settings), [data?.settings]);

  const groups = useMemo(() => {
    const g = (data?.groups ?? [])
      .filter((x) => x.enabled ?? true)
      .slice()
      .sort((a, b) => a.order - b.order);
    return g;
  }, [data]);

  const enabledGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const allLinks = useMemo(() => {
    return (data?.links ?? []).filter((l) => enabledGroupIds.has(l.groupId)).slice();
  }, [data, enabledGroupIds]);

  const allSections = useMemo(() => {
    return (data?.sections ?? []).filter((s) => enabledGroupIds.has(s.groupId)).slice().sort((a, b) => a.order - b.order);
  }, [data, enabledGroupIds]);

  const sectionsByGroupId = useMemo(() => {
    const m = new Map<string, Section[]>();
    for (const s of allSections) {
      const arr = m.get(s.groupId) ?? [];
      arr.push(s);
      m.set(s.groupId, arr);
    }
    for (const [gid, arr] of m) {
      arr.sort((a, b) => a.order - b.order);
      m.set(gid, arr);
    }
    return m;
  }, [allSections]);

  const sectionOrderById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allSections) m.set(s.id, s.order);
    return m;
  }, [allSections]);

  function compareLinkWithSections(a: LinkItem, b: LinkItem) {
    const aSec = a.sectionId?.trim() ? sectionOrderById.get(a.sectionId.trim()) ?? 9998 : 9999;
    const bSec = b.sectionId?.trim() ? sectionOrderById.get(b.sectionId.trim()) ?? 9998 : 9999;
    if (aSec !== bSec) return aSec - bSec;
    return a.order - b.order;
  }

  function groupLinksBySection(groupId: string, links: LinkItem[]) {
    const sections = sectionsByGroupId.get(groupId) ?? [];
    if (!sections.length) {
      return { enabled: false, blocks: [] as { key: string; title: string; links: LinkItem[] }[] };
    }

    const sectionIdSet = new Set(sections.map((s) => s.id));
    const bySection = new Map<string, LinkItem[]>();
    for (const l of links) {
      const sid = l.sectionId?.trim();
      const key = sid && sectionIdSet.has(sid) ? sid : DEFAULT_SECTION_ID;
      const arr = bySection.get(key) ?? [];
      arr.push(l);
      bySection.set(key, arr);
    }

    const blocks: { key: string; title: string; links: LinkItem[] }[] = [];
    for (const s of sections) {
      const arr = bySection.get(s.id);
      if (!arr?.length) continue;
      blocks.push({ key: s.id, title: s.name, links: arr });
    }
    const ungrouped = bySection.get(DEFAULT_SECTION_ID);
    if (ungrouped?.length) blocks.push({ key: DEFAULT_SECTION_ID, title: "未分组", links: ungrouped });

    return { enabled: true, blocks };
  }

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId(null);
      setHoveredGroupId(null);
      return;
    }

    const storageKey = "cloudnav:selectedGroupId";
    const saved = (() => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();

    const isValid = (id: string | null) => id === "__all__" || (!!id && groups.some((g) => g.id === id));
    const initial = isValid(saved) ? saved : "__all__";

    setSelectedGroupId((prev) => (isValid(prev) ? prev : initial));
    setHoveredGroupId((prev) => (isValid(prev) ? prev : initial));
  }, [groups]);

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
      .sort(compareLinkWithSections);
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
    for (const arr of map.values()) arr.sort(compareLinkWithSections);
    return map;
  }, [allLinks, query]);

  const visibleGroupsAll: Group[] = useMemo(() => {
    if (!query) return groups;
    return groups.filter((g) => (linksByGroupAll.get(g.id)?.length ?? 0) > 0);
  }, [groups, linksByGroupAll, query]);

  return (
    <div className="app-bg">
      <Navbar authed={authed === true} settings={data?.settings} />

      {isMobile ? (
        <div className="fixed left-0 right-0 z-[39] sm:hidden" style={{ top: `${APPBAR_H + GAP}px` }}>
          <div className="mx-auto max-w-6xl px-4">
            <MobileCategoryBar
              items={sidebarGroups}
              selectedId={selectedGroupId}
              onSelect={(id) => {
                setSelectedGroupId(id);
                setHoveredGroupId(id);
                try {
                  localStorage.setItem("cloudnav:selectedGroupId", id);
                } catch {
                  // ignore
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:pt-8">
        {isMobile ? <div className="sm:hidden" style={{ height: `${MOBILE_CAT_H + GAP}px` }} /> : null}
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.18 } : { type: "spring", stiffness: 420, damping: 34 }}
          className="space-y-6"
        >
          <div className="hidden space-y-1 sm:block">
            <div className="text-2xl font-semibold tracking-tight">导航</div>
            <div className="text-sm text-muted">{site.homeTagline}</div>
          </div>

          {error ? <div className="glass rounded-2xl p-4 text-sm text-danger">{error}</div> : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <aside className="hidden lg:block lg:col-span-3">
              <SidebarCategoryPicker
                groups={sidebarGroups}
                selectedId={selectedGroupId}
                hoveredId={hoveredGroupId ?? selectedGroupId}
                onHover={(id) => setHoveredGroupId(id)}
                onSelect={(id) => {
                  setSelectedGroupId(id);
                  setHoveredGroupId(id);
                  try {
                    localStorage.setItem("cloudnav:selectedGroupId", id);
                  } catch {
                    // ignore
                  }
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
                <div className="hidden w-full sm:block sm:w-[360px]">
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
                      const sectioned = groupLinksBySection(g.id, links);
                      return (
                        <motion.section key={g.id} layout className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-fg/90">{g.name}</div>
                            <div className="text-xs text-muted">{links.length} 项</div>
                          </div>
                          {sectioned.enabled ? (
                            <div className="space-y-4">
                              {sectioned.blocks.map((b) => (
                                <motion.section key={b.key} layout className="space-y-2">
                                  <div className="text-xs font-semibold text-fg/70">{b.title}</div>
                                  <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {b.links.map((l) => (
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
                              ))}
                            </div>
                          ) : (
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
                          )}
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
                      className="space-y-4"
                    >
                      {selectedGroup ? (() => {
                        const sectioned = groupLinksBySection(selectedGroup.id, filteredLinks);
                        if (sectioned.enabled) {
                          return sectioned.blocks.map((b) => (
                            <motion.section key={b.key} layout className="space-y-2">
                              <div className="text-xs font-semibold text-fg/70">{b.title}</div>
                              <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {b.links.map((l) => (
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
                          ));
                        }
                        return (
                          <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        );
                      })() : null}
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

      <MobileSearchFAB value={query} onChange={setQuery} />
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
