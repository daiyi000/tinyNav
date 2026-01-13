import { motion, useReducedMotion } from "framer-motion";
import { Globe, LogOut, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { BrandingCard } from "../components/BrandingCard";
import { Modal } from "../components/Modal";
import { Navbar } from "../components/Navbar";
import { Switch } from "../components/Switch";
import { SortableOverlayList } from "../components/sortable/SortableOverlayList";
import { ApiError, api } from "../lib/api";
import { useMe } from "../lib/auth";
import { faviconServiceUrl, normalizeFaviconUrl } from "../lib/favicon";
import { applyFavicon } from "../lib/siteSettings";
import { isHttpOrHttpsUrl, normalizeHttpUrl } from "../lib/url";
import type { CloudNavData, Group, LinkItem } from "../types";

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

export default function Admin() {
  const reduceMotion = useReducedMotion();
  const { authed } = useMe();
  const nav = useNavigate();

  const [data, setData] = useState<CloudNavData | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);

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

  const linksInSelectedGroup = useMemo(() => {
    if (!selectedGroup) return [];
    return links.filter((l) => l.groupId === selectedGroup.id).sort((a, b) => a.order - b.order);
  }, [links, selectedGroup]);

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

  async function createLink(input: { title: string; url: string; description: string; icon: string }) {
    if (!selectedGroup) return;
    setBusy(true);
    setError(null);
    try {
      const url = isHttpOrHttpsUrl(input.url) ? input.url : normalizeHttpUrl(input.url);
      await api.admin.links.create({
        groupId: selectedGroup.id,
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

  async function updateLink(id: string, patch: { title: string; url: string; description: string; icon: string }) {
    setBusy(true);
    setError(null);
    try {
      const url = isHttpOrHttpsUrl(patch.url) ? patch.url : normalizeHttpUrl(patch.url);
      await api.admin.links.update(id, {
        title: patch.title,
        url,
        icon: patch.icon,
        description: patch.description || ""
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="p-4 lg:col-span-4">
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
                      onDelete={() => {
                        if (!confirm(`删除分类「${g.name}」？该分类下的链接也会被删除。`)) return;
                        deleteGroup(g.id).catch(() => undefined);
                      }}
                    />
                  )}
                />
              </div>
            </Card>

            <Card className="p-4 lg:col-span-8">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{selectedGroup ? `链接 · ${selectedGroup.name}` : "链接"}</div>
                <Button
                  variant="secondary"
                  leftIcon={<Plus size={18} />}
                  onClick={() => setCreatingLink(true)}
                  disabled={!selectedGroup || busy}
                >
                  新增
                </Button>
              </div>

              <div className="mt-3">
                {selectedGroup ? (
                  <SortableOverlayList
                    items={linksInSelectedGroup}
                    onReorder={reorderLinksInSelectedGroup}
                    renderItem={(l, handle) => (
                      <LinkRow
                        link={l}
                        busy={busy}
                        handle={handle}
                        onEdit={() => setEditingLink(l)}
                        onDelete={() => {
                          if (!confirm(`删除链接「${l.title}」？`)) return;
                          deleteLink(l.id).catch(() => undefined);
                        }}
                      />
                    )}
                  />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-6 text-sm text-muted">
                    还没有分类。先添加一个分类。
                  </div>
                )}

                {selectedGroup && !linksInSelectedGroup.length ? (
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-6 text-sm text-muted">
                    这个分类还没有链接。点击右上角“新增”。
                  </div>
                ) : null}
              </div>
             </Card>
           </div>

           <BrandingCard
             settings={data?.settings}
             disabled={busy}
             onSettingsSaved={(next) => setData((prev) => (prev ? { ...prev, settings: next } : prev))}
           />
         </motion.div>
      </main>

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
        onSubmit={(name) => {
          const g = editingGroup;
          setEditingGroup(null);
          if (!g) return;
          updateGroup(g.id, name).catch(() => undefined);
        }}
      />

      <LinkEditorModal
        open={creatingLink}
        mode="create"
        title="新增链接"
        initial={{ title: "", url: "", description: "", icon: "" }}
        onClose={() => setCreatingLink(false)}
        onSubmit={(patch) => {
          setCreatingLink(false);
          createLink(patch).catch(() => undefined);
        }}
      />

      <LinkEditorModal
        open={!!editingLink}
        mode="edit"
        title="编辑链接"
        initial={{
          title: editingLink?.title ?? "",
          url: editingLink?.url ?? "",
          description: editingLink?.description ?? "",
          icon: editingLink?.icon ?? ""
        }}
        onClose={() => setEditingLink(null)}
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
        disabled={!onSelect}
      >
        <div className={"font-medium truncate " + (enabled ? "" : "opacity-60")}>{group.name}</div>
      </button>

      <div className="flex-none">
        <Switch checked={enabled} disabled={busy || !onToggleEnabled} onCheckedChange={(v) => onToggleEnabled?.(v)} />
      </div>

      <div className="ml-auto flex flex-none items-center gap-1">
        <Button variant="ghost" className="h-9 w-9 px-0" onClick={onEdit} disabled={!onEdit} leftIcon={<Pencil size={16} />} />
        <Button variant="destructive" className="h-9 w-9 px-0" onClick={onDelete} disabled={!onDelete} leftIcon={<Trash2 size={16} />} />
      </div>
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
      <div className="min-w-[14rem] flex-1">
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
      <div className="ml-auto flex flex-none items-center gap-1">
        <Button variant="ghost" className="h-9 w-9 px-0" onClick={onEdit} disabled={!onEdit} leftIcon={<Pencil size={16} />} />
        <Button variant="destructive" className="h-9 w-9 px-0" onClick={onDelete} disabled={!onDelete} leftIcon={<Trash2 size={16} />} />
      </div>
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
  onSubmit
}: {
  open: boolean;
  title: string;
  initial: { name: string };
  onClose: () => void;
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
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
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
  initial,
  onClose,
  onSubmit
}: {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  initial: { title: string; url: string; description: string; icon?: string };
  onClose: () => void;
  onSubmit: (patch: { title: string; url: string; description: string; icon: string }) => void;
}) {
  const [titleValue, setTitleValue] = useState(initial.title);
  const [urlValue, setUrlValue] = useState(initial.url);
  const [descValue, setDescValue] = useState(initial.description);
  const [iconValue, setIconValue] = useState(initial.icon ?? "");

  useEffect(() => {
    if (!open) {
      if (mode === "create") {
        setTitleValue("");
        setUrlValue("");
        setDescValue("");
        setIconValue("");
      }
      return;
    }

    if (mode === "create") {
      setTitleValue("");
      setUrlValue("");
      setDescValue("");
      setIconValue("");
      return;
    }

    setTitleValue(initial.title);
    setUrlValue(initial.url);
    setDescValue(initial.description);
    setIconValue(initial.icon ?? "");
  }, [open, mode, initial.title, initial.url, initial.description, initial.icon]);

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
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onSubmit({
                title: titleValue.trim(),
                url: urlValue.trim(),
                description: descValue.trim(),
                icon: iconValue.trim()
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
