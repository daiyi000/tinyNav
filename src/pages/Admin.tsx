import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Globe, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminDock, type AdminDockTab } from "../components/AdminDock";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { BrandingCard } from "../components/BrandingCard";
import { Modal } from "../components/Modal";
import { Navbar } from "../components/Navbar";
import { Switch } from "../components/Switch";
import { SectionedLinksPanel } from "../components/admin/SectionedLinksPanel";
import { SortableOverlayList } from "../components/sortable/SortableOverlayList";
import { ApiError, api } from "../lib/api";
import { useMe } from "../lib/auth";
import { faviconServiceUrl, normalizeFaviconUrl } from "../lib/favicon";
import { applyFavicon } from "../lib/siteSettings";
import { isHttpOrHttpsUrl, normalizeHttpUrl } from "../lib/url";
import type { CloudNavData, Group, LinkItem, Section } from "../types";

function toErrorView(e: unknown, fallback: string): { message: string; details?: string[] } {
  if (e instanceof ApiError) {
    const lines = formatZodIssues(e.details);
    return { message: e.message || fallback, details: lines };
  }
  if (e instanceof Error) return { message: e.message || fallback };
  return { message: fallback };
}

function formatZodIssues(details: unknown): string[] | undefined {
  if (!Array.isArray(details)) return undefined;
  const lines: string[] = [];
  for (const it of details) {
    const message = (it as any)?.message;
    const path = (it as any)?.path;
    if (typeof message !== "string") continue;
    const pathText = Array.isArray(path) && path.length ? path.map(String).join(".") : "";
    lines.push(pathText ? `${pathText}: ${message}` : message);
  }
  return lines.length ? lines : undefined;
}

type AppleSelectOption = { value: string; label: string };

function AppleSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  ariaLabel
}: {
  value: string;
  onChange: (next: string) => void;
  options: AppleSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => listRef.current?.focus());
  }, [open]);

  function commit(next: string) {
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function clampIndex(i: number) {
    return Math.max(0, Math.min(options.length - 1, i));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => listRef.current?.focus());
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
            return;
          }
        }}
        className="glass flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:opacity-50"
      >
        <span className={selectedLabel ? "truncate" : "truncate text-muted"}>{selectedLabel || placeholder || "选择…"}</span>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="popover"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 520, damping: 38 }}
            className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/12 bg-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:bg-white/8 dark:shadow-[0_26px_80px_rgba(0,0,0,0.55)]"
          >
            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  return;
                }
                if (e.key === "Tab") {
                  setOpen(false);
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => clampIndex(i + 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => clampIndex(i - 1));
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = options[activeIndex];
                  if (next) commit(next.value);
                  return;
                }
              }}
              className="max-h-64 overflow-auto p-1 outline-none"
            >
              {options.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(opt.value)}
                    className={[
                      "flex cursor-default items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                      isActive ? "bg-white/14 dark:bg-white/10" : "bg-transparent",
                      isSelected ? "text-fg" : "text-fg/90"
                    ].join(" ")}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected ? <Check size={16} className="shrink-0 text-fg/80" /> : <span className="h-4 w-4 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function Admin() {
  const reduceMotion = useReducedMotion();
  const { authed } = useMe();
  const nav = useNavigate();

  const [data, setData] = useState<CloudNavData | null>(null);
  const [activeTab, setActiveTab] = useState<AdminDockTab>("nav");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [creatingLinkSectionId, setCreatingLinkSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (authed === false) nav("/login", { replace: true, state: { from: "/admin" } });
  }, [authed, nav]);

  async function refreshData() {
    const d = await api.linksNoCache();
    setData(d);
    setSelectedGroupId((prev) => {
      if (prev && d.groups.some((g) => g.id === prev)) return prev;
      return d.groups[0]?.id ?? null;
    });
  }

  useEffect(() => {
    refreshData().catch((e: unknown) => setError(toErrorView(e, "加载失败")));
  }, []);

  useEffect(() => {
    applyFavicon(data?.settings?.faviconDataUrl);
  }, [data?.settings?.faviconDataUrl]);

  const groups = useMemo(() => (data ? data.groups.slice().sort((a, b) => a.order - b.order) : []), [data]);
  const links = useMemo(() => (data ? data.links.slice() : []), [data]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId]
  );

  const sectionsInSelectedGroup = useMemo(() => {
    if (!selectedGroup) return [];
    return (data?.sections ?? []).filter((s) => s.groupId === selectedGroup.id).slice().sort((a, b) => a.order - b.order);
  }, [data?.sections, selectedGroup]);

  const sectionOptionsForSelectedGroup = useMemo(() => {
    const out: { id: string; label: string }[] = [{ id: "", label: "未分组" }];
    for (const s of sectionsInSelectedGroup) out.push({ id: s.id, label: s.name });
    return out;
  }, [sectionsInSelectedGroup]);

  async function logout() {
    await api.logout();
    nav("/", { replace: true });
  }

  async function reorderGroups(nextIds: string[]) {
    if (!data) return;
    setError(null);
    setData((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.groups.map((g) => [g.id, g] as const));
      const nextGroups = nextIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
      return { ...prev, groups: nextGroups };
    });
    try {
      await api.admin.reorder({ groups: nextIds.map((id, i) => ({ id, order: i })) });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "排序保存失败"));
      await refreshData();
    }
  }

  async function reorderSectionsAndLinks(payload: {
    sections: { id: string; order: number }[];
    links: { id: string; order: number; sectionId: string | null }[];
  }) {
    if (!data) return;
    setError(null);
    setData((prev) => {
      if (!prev) return prev;
      const sectionOrder = new Map(payload.sections.map((s) => [s.id, s.order] as const));
      const linkOrder = new Map(payload.links.map((l) => [l.id, l] as const));
      const nextSections = (prev.sections ?? []).map((s) =>
        sectionOrder.has(s.id) ? { ...s, order: sectionOrder.get(s.id)! } : s
      );
      const nextLinks = prev.links.map((l) => {
        const p = linkOrder.get(l.id);
        if (!p) return l;
        return { ...l, order: p.order, sectionId: p.sectionId ?? undefined };
      });
      return { ...prev, sections: nextSections, links: nextLinks };
    });
    try {
      await api.admin.reorder({
        sections: payload.sections,
        links: payload.links.map((l) => ({ id: l.id, order: l.order, sectionId: l.sectionId }))
      });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "排序保存失败"));
      await refreshData();
    }
  }

  async function reorderLinksInSelectedGroup(nextIds: string[]) {
    if (!selectedGroup) return;
    setError(null);
    setData((prev) => {
      if (!prev) return prev;
      const other = prev.links.filter((l) => l.groupId !== selectedGroup.id);
      const byId = new Map(prev.links.map((l) => [l.id, l] as const));
      const nextLinks = nextIds.map((id, i) => ({ ...byId.get(id)!, order: i }));
      return { ...prev, links: [...other, ...nextLinks] };
    });
    try {
      await api.admin.reorder({ links: nextIds.map((id, i) => ({ id, order: i })) });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "排序保存失败"));
      await refreshData();
    }
  }

  async function createGroup(name: string) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.groups.create(name);
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "创建失败"));
    } finally {
      setBusy(false);
    }
  }

  async function updateGroup(id: string, name: string) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.groups.update(id, { name });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "更新失败"));
    } finally {
      setBusy(false);
    }
  }

  async function updateGroupEnabled(id: string, enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.groups.update(id, { enabled });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "更新失败"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.groups.delete(id);
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "删除失败"));
    } finally {
      setBusy(false);
    }
  }

  async function createSection(name: string) {
    if (!selectedGroup) return;
    setBusy(true);
    setError(null);
    try {
      await api.admin.sections.create({ groupId: selectedGroup.id, name });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "创建二级分类失败"));
    } finally {
      setBusy(false);
    }
  }

  async function updateSection(id: string, name: string) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.sections.update(id, { name });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "更新二级分类失败"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.sections.delete(id);
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "删除二级分类失败"));
    } finally {
      setBusy(false);
    }
  }

  async function createLink(input: { title: string; url: string; description: string; icon: string; sectionId: string | null }) {
    if (!selectedGroup) return;
    setBusy(true);
    setError(null);
    try {
      const url = isHttpOrHttpsUrl(input.url) ? input.url : normalizeHttpUrl(input.url);
      await api.admin.links.create({
        groupId: selectedGroup.id,
        sectionId: input.sectionId || undefined,
        title: input.title,
        url,
        icon: input.icon || undefined,
        description: input.description || undefined
      });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "创建失败"));
    } finally {
      setBusy(false);
    }
  }

  async function updateLink(
    id: string,
    patch: { title: string; url: string; description: string; icon: string; sectionId: string | null }
  ) {
    setBusy(true);
    setError(null);
    try {
      const url = isHttpOrHttpsUrl(patch.url) ? patch.url : normalizeHttpUrl(patch.url);
      await api.admin.links.update(id, {
        title: patch.title,
        url,
        icon: patch.icon,
        description: patch.description || "",
        sectionId: patch.sectionId
      });
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "更新失败"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.links.delete(id);
      await refreshData();
    } catch (e: unknown) {
      setError(toErrorView(e, "删除失败"));
    } finally {
      setBusy(false);
    }
  }

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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight">管理</div>
              <div className="text-sm text-muted">更改会实时保存到 KV。</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<RefreshCw size={18} />}
                onClick={() => refreshData().catch(() => undefined)}
                disabled={busy}
              >
                刷新
              </Button>
              <Button variant="secondary" leftIcon={<LogOut size={18} />} onClick={logout} disabled={busy}>
                退出
              </Button>
            </div>
          </div>

          {error ? (
            <div className="glass rounded-2xl p-4 text-sm">
              <div className="font-medium text-danger">{error.message}</div>
              {error.details?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-danger/90">
                  {error.details.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {activeTab === "nav" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card interactive={false} className="p-4 lg:col-span-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">分类</div>
                <Button
                  variant="secondary"
                  leftIcon={<Plus size={18} />}
                  onClick={() => setCreatingGroup(true)}
                  disabled={busy}
                >
                  新增
                </Button>
              </div>
              <div className="mt-3">
                <SortableOverlayList
                  items={groups}
                  onReorder={reorderGroups}
                  renderItem={(g, handle) => (
                    <GroupRow
                      group={g}
                      selected={selectedGroup?.id === g.id}
                      busy={busy}
                      handle={handle}
                      onSelect={() => setSelectedGroupId(g.id)}
                      onToggleEnabled={(next) => updateGroupEnabled(g.id, next).catch(() => undefined)}
                      onEdit={() => setEditingGroup(g)}
                    />
                  )}
                />
              </div>
            </Card>

            <Card interactive={false} className="p-4 lg:col-span-8">
              {selectedGroup ? (
                <SectionedLinksPanel
                  groupId={selectedGroup.id}
                  groupName={selectedGroup.name}
                  sections={sectionsInSelectedGroup}
                  links={links.filter((l) => l.groupId === selectedGroup.id)}
                  busy={busy}
                  onCreateSection={() => setCreatingSection(true)}
                  onEditSection={(s) => setEditingSection(s)}
                  onDeleteSection={(s) => {
                    if (!confirm(`删除二级分类「${s.name}」？该分类内的链接会移动到未分组。`)) return;
                    deleteSection(s.id).catch(() => undefined);
                  }}
                  onCreateLink={(sectionId) => {
                    setCreatingLinkSectionId(sectionId);
                    setCreatingLink(true);
                  }}
                  onEditLink={(l) => setEditingLink(l)}
                  onDeleteLink={(l) => {
                    if (!confirm(`删除链接「${l.title}」？`)) return;
                    deleteLink(l.id).catch(() => undefined);
                  }}
                  onPersistReorder={reorderSectionsAndLinks}
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-6 text-sm text-muted">
                  还没有分类。先添加一个分类。
                </div>
              )}
            </Card>
           </div>
          ) : null}

          {activeTab === "settings" ? (
          <BrandingCard
            settings={data?.settings}
            disabled={busy}
            onSettingsSaved={(next) => setData((prev) => (prev ? { ...prev, settings: next } : prev))}
          />
          ) : null}
         </motion.div>
      </main>

      <AdminDock activeTab={activeTab} onChangeTab={setActiveTab} />

      <GroupModal
        open={creatingGroup}
        title="新增分类"
        initial={{ name: "" }}
        onClose={() => setCreatingGroup(false)}
        onSubmit={(name) => {
          setCreatingGroup(false);
          createGroup(name).catch(() => undefined);
        }}
      />

      <GroupModal
        open={!!editingGroup}
        title="编辑分类"
        initial={{ name: editingGroup?.name ?? "" }}
        onClose={() => setEditingGroup(null)}
        onDelete={() => {
          const g = editingGroup;
          setEditingGroup(null);
          if (!g) return;
          if (!confirm(`删除分类「${g.name}」？该分类下的链接也会被删除。`)) return;
          deleteGroup(g.id).catch(() => undefined);
        }}
        onSubmit={(name) => {
          const g = editingGroup;
          setEditingGroup(null);
          if (!g) return;
          updateGroup(g.id, name).catch(() => undefined);
        }}
      />

      <GroupModal
        open={creatingSection}
        title="新增二级分类"
        initial={{ name: "" }}
        onClose={() => setCreatingSection(false)}
        onSubmit={(name) => {
          setCreatingSection(false);
          createSection(name).catch(() => undefined);
        }}
      />

      <GroupModal
        open={!!editingSection}
        title="编辑二级分类"
        initial={{ name: editingSection?.name ?? "" }}
        onClose={() => setEditingSection(null)}
        onDelete={() => {
          const s = editingSection;
          setEditingSection(null);
          if (!s) return;
          if (!confirm(`删除二级分类「${s.name}」？该分类内的链接会移动到未分组。`)) return;
          deleteSection(s.id).catch(() => undefined);
        }}
        onSubmit={(name) => {
          const s = editingSection;
          setEditingSection(null);
          if (!s) return;
          updateSection(s.id, name).catch(() => undefined);
        }}
      />

      <LinkEditorModal
        open={creatingLink}
        mode="create"
        title="新增链接"
        sectionOptions={sectionOptionsForSelectedGroup}
        initial={{ title: "", url: "", description: "", icon: "", sectionId: creatingLinkSectionId ?? "" }}
        onClose={() => {
          setCreatingLink(false);
          setCreatingLinkSectionId(null);
        }}
        onSubmit={(patch) => {
          setCreatingLink(false);
          createLink(patch).catch(() => undefined);
        }}
      />

      <LinkEditorModal
        open={!!editingLink}
        mode="edit"
        title="编辑链接"
        sectionOptions={sectionOptionsForSelectedGroup}
        initial={{
          title: editingLink?.title ?? "",
          url: editingLink?.url ?? "",
          description: editingLink?.description ?? "",
          icon: editingLink?.icon ?? "",
          sectionId: editingLink?.sectionId ?? ""
        }}
        onClose={() => setEditingLink(null)}
        onDelete={() => {
          const l = editingLink;
          setEditingLink(null);
          if (!l) return;
          if (!confirm(`删除链接「${l.title}」？`)) return;
          deleteLink(l.id).catch(() => undefined);
        }}
        onSubmit={(patch) => {
          const l = editingLink;
          setEditingLink(null);
          if (!l) return;
          updateLink(l.id, patch).catch(() => undefined);
        }}
      />
    </div>
  );
}

function GroupRow({
  group,
  selected,
  busy,
  handle,
  overlay,
  onSelect,
  onToggleEnabled,
  onEdit,
  onDelete
}: {
  group: Group;
  selected: boolean;
  busy: boolean;
  handle?: React.ReactNode;
  overlay?: boolean;
  onSelect?: () => void;
  onToggleEnabled?: (next: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const enabled = group.enabled ?? true;
  return (
    <div
      className={
        "flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-2 " +
        (overlay ? "shadow-[0_30px_90px_rgba(0,0,0,.18)] dark:shadow-[0_30px_110px_rgba(0,0,0,.55)]" : "")
      }
    >
      <div className="flex-none">{handle ?? <div className="h-9 w-9" />}</div>
      <button
        type="button"
        className={
          "flex-1 min-w-[10rem] rounded-2xl px-3 py-2 text-left text-sm transition border " +
          (selected ? "bg-white/12 dark:bg-white/8 border-white/12" : "bg-transparent border-transparent hover:bg-white/6 dark:hover:bg-white/6")
        }
        onClick={onSelect}
        onDoubleClick={onEdit}
        disabled={!onSelect}
      >
        <div className={"font-medium truncate " + (enabled ? "" : "opacity-60")}>{group.name}</div>
      </button>

      <div className="flex-none">
        <Switch checked={enabled} disabled={busy || !onToggleEnabled} onCheckedChange={(v) => onToggleEnabled?.(v)} />
      </div>

      <div className="ml-auto flex flex-none items-center gap-1" />
    </div>
  );
}

function LinkRow({
  link,
  busy,
  handle,
  overlay,
  onEdit,
  onDelete
}: {
  link: LinkItem;
  busy: boolean;
  handle?: React.ReactNode;
  overlay?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={
        "flex flex-wrap items-start gap-2 rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-3 " +
        (overlay ? "shadow-[0_30px_90px_rgba(0,0,0,.18)] dark:shadow-[0_30px_110px_rgba(0,0,0,.55)]" : "")
      }
    >
      <div className="pt-0.5 flex-none">{handle ?? <div className="h-9 w-9" />}</div>
      <div className="min-w-[14rem] flex-1" onDoubleClick={onEdit}>
        <div className="flex items-center gap-2">
          <LinkRowIcon url={link.url} icon={link.icon} />
          <div className="truncate text-sm font-semibold">{link.title}</div>
          {link.icon?.trim() ? (
            <span className="ml-1 rounded-full border border-white/10 bg-white/6 dark:bg-white/5 px-2 py-0.5 text-[11px] text-muted">
              icon
            </span>
          ) : null}
        </div>
        <div className="mt-1 truncate text-xs text-muted">{link.url}</div>
        {link.description ? <div className="mt-1 line-clamp-2 text-xs text-muted">{link.description}</div> : null}
      </div>
      <div className="ml-auto flex flex-none items-center gap-1" />
    </div>
  );
}

function LinkRowIcon({ url, icon }: { url: string; icon?: string }) {
  const [fallback, setFallback] = useState(false);
  const primary = icon?.trim() ? icon.trim() : normalizeFaviconUrl(url);
  const src = fallback ? faviconServiceUrl(url) : primary;
  return (
    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/10 dark:bg-white/6">
      {src ? (
        <img
          src={src}
          alt=""
          className="block h-4 w-4 shrink-0 rounded"
          onError={() => setFallback(true)}
        />
      ) : (
        <Globe size={14} className="text-muted" />
      )}
    </div>
  );
}

function GroupModal({
  open,
  title,
  initial,
  onClose,
  onDelete,
  onSubmit
}: {
  open: boolean;
  title: string;
  initial: { name: string };
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial.name);
  useEffect(() => setName(initial.name), [initial.name]);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <label className="block space-y-2">
          <div className="text-sm font-medium text-fg/80">名称</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            placeholder="例如：开发 / 设计 / 工具…"
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          {onDelete ? (
            <Button variant="destructive" className="h-10 px-3" onClick={onDelete} leftIcon={<Trash2 size={18} />}>
              删除
            </Button>
          ) : (
            <div />
          )}
          <Button variant="primary" onClick={() => onSubmit(name.trim())} disabled={!name.trim()}>
            确认
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LinkEditorModal({
  open,
  mode,
  title,
  sectionOptions,
  initial,
  onClose,
  onDelete,
  onSubmit
}: {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  sectionOptions: { id: string; label: string }[];
  initial: { title: string; url: string; description: string; icon?: string; sectionId: string };
  onClose: () => void;
  onDelete?: () => void;
  onSubmit: (patch: { title: string; url: string; description: string; icon: string; sectionId: string | null }) => void;
}) {
  const [titleValue, setTitleValue] = useState(initial.title);
  const [urlValue, setUrlValue] = useState(initial.url);
  const [descValue, setDescValue] = useState(initial.description);
  const [iconValue, setIconValue] = useState(initial.icon ?? "");
  const [sectionIdValue, setSectionIdValue] = useState(initial.sectionId);
  const [fetchTitleBusy, setFetchTitleBusy] = useState(false);
  const [fetchTitleError, setFetchTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      if (mode === "create") {
        setTitleValue("");
        setUrlValue("");
        setDescValue("");
        setIconValue("");
        setSectionIdValue(initial.sectionId);
        setFetchTitleBusy(false);
        setFetchTitleError(null);
      }
      return;
    }

    if (mode === "create") {
      setTitleValue("");
      setUrlValue("");
      setDescValue("");
      setIconValue("");
      setSectionIdValue(initial.sectionId);
      setFetchTitleBusy(false);
      setFetchTitleError(null);
      return;
    }

    setTitleValue(initial.title);
    setUrlValue(initial.url);
    setDescValue(initial.description);
    setIconValue(initial.icon ?? "");
    setSectionIdValue(initial.sectionId);
    setFetchTitleBusy(false);
    setFetchTitleError(null);
  }, [open, mode, initial.title, initial.url, initial.description, initial.icon, initial.sectionId]);

  async function fetchTitleIntoForm() {
    setFetchTitleError(null);
    const normalized = isHttpOrHttpsUrl(urlValue) ? urlValue : normalizeHttpUrl(urlValue);
    if (normalized && normalized !== urlValue) setUrlValue(normalized);
    if (!normalized) return;

    setFetchTitleBusy(true);
    try {
      const res = await api.admin.fetchTitle(normalized);
      const fetched = (res.title ?? "").toString().trim().replace(/\s+/g, " ");
      if (!fetched) {
        setFetchTitleError("未能获取到网页标题");
        return;
      }

      if (!descValue.trim()) setDescValue(fetched);
      if (!titleValue.trim()) setTitleValue(fetched);
    } catch (e: unknown) {
      setFetchTitleError(e instanceof ApiError ? e.message : "自动获取标题失败");
    } finally {
      setFetchTitleBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-xs text-muted">在这里编辑本导航站显示的标题/描述/图标。</div>
        <label className="block space-y-2">
          <div className="text-sm font-medium text-fg/80">标题</div>
          <input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            placeholder="例如：Cloudflare Docs"
          />
        </label>
        <label className="block space-y-2">
          <div className="text-sm font-medium text-fg/80">URL</div>
          <input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onBlur={() => {
              const normalized = isHttpOrHttpsUrl(urlValue) ? urlValue : normalizeHttpUrl(urlValue);
              if (normalized && normalized !== urlValue) setUrlValue(normalized);
              if (!iconValue.trim() && normalized) setIconValue(normalizeFaviconUrl(normalized));
            }}
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            placeholder="https://..."
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              className="h-9 px-3"
              leftIcon={<RefreshCw size={18} className={fetchTitleBusy ? "animate-spin" : ""} />}
              onClick={() => fetchTitleIntoForm()}
              disabled={!urlValue.trim() || fetchTitleBusy}
            >
              自动获取标题
            </Button>
            <div className="text-xs text-muted">将网页标题填入描述</div>
          </div>
          {fetchTitleError ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
              {fetchTitleError}
            </div>
          ) : null}
        </label>

        <label className="block space-y-2">
          <div className="text-sm font-medium text-fg/80">二级分类</div>
          <AppleSelect
            ariaLabel="二级分类"
            value={sectionIdValue}
            onChange={setSectionIdValue}
            options={sectionOptions.map((o) => ({ value: o.id, label: o.label }))}
            placeholder="未分组"
          />
        </label>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="text-sm font-medium text-fg/80">图标（可选）</div>
            <input
              value={iconValue}
              onChange={(e) => setIconValue(e.target.value)}
              className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              placeholder="https://.../icon.png（留空=自动）"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="h-9 px-3"
                onClick={() => {
                  const normalized = isHttpOrHttpsUrl(urlValue) ? urlValue : normalizeHttpUrl(urlValue);
                  if (normalized) setUrlValue(normalized);
                  setIconValue("");
                }}
                disabled={!urlValue.trim()}
              >
                恢复自动
              </Button>
              <div className="text-xs text-muted">优先使用你填写的 icon URL</div>
            </div>
          </div>
          <IconPreview siteUrl={urlValue} iconUrl={iconValue} />
        </div>
        <label className="block space-y-2">
          <div className="text-sm font-medium text-fg/80">描述（可选）</div>
          <textarea
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
            rows={3}
            placeholder="一句话说明用途…"
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          {mode === "edit" && onDelete ? (
            <Button variant="destructive" className="h-10 px-3" onClick={onDelete} leftIcon={<Trash2 size={18} />}>
              删除
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant="primary"
            onClick={() =>
              onSubmit({
                title: titleValue.trim(),
                url: urlValue.trim(),
                description: descValue.trim(),
                icon: iconValue.trim(),
                sectionId: sectionIdValue ? sectionIdValue : null
              })
            }
            disabled={!titleValue.trim() || !urlValue.trim()}
          >
            确认
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IconPreview({ siteUrl, iconUrl }: { siteUrl: string; iconUrl: string }) {
  const [fallback, setFallback] = useState(false);
  const primary = iconUrl.trim() ? iconUrl.trim() : normalizeFaviconUrl(siteUrl);
  const src = fallback ? faviconServiceUrl(siteUrl) : primary;
  return (
    <div className="mt-1 flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-6 w-6 rounded-md"
          onError={() => setFallback(true)}
        />
      ) : (
        <Globe size={18} className="text-muted" />
      )}
    </div>
  );
}
