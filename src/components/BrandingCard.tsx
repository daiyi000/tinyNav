import { motion, useReducedMotion } from "framer-motion";
import { Check, Eraser, RotateCcw, Save, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { applyFavicon, DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from "../lib/siteSettings";
import type { SiteSettings } from "../types";
import { Button } from "./Button";
import { Card } from "./Card";
import { TopBarIcon } from "./TopBarIcon";

const MAX_IMAGE_BYTES = 200 * 1024;

function toErrorMessage(e: unknown) {
  if (e instanceof ApiError) return e.message || `HTTP ${e.status}`;
  if (e instanceof Error) return e.message;
  return "保存失败";
}

function isIco(file: File) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return t === "image/x-icon" || t === "image/vnd.microsoft.icon" || n.endsWith(".ico");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function getBitmapSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  if (!dataUrl.startsWith("data:")) return null;
  if (!/^data:image\//.test(dataUrl)) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

type ImageInfo = {
  src: string;
  bytes?: number;
  type?: string;
  name?: string;
  originalWidth?: number;
  originalHeight?: number;
  width?: number;
  height?: number;
  trimmed?: boolean;
};

function dataUrlMime(dataUrl: string): string | null {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return m?.[1] ?? null;
}

async function trimEdgeDataUrl(dataUrl: string): Promise<{ dataUrl: string; from?: { w: number; h: number }; to?: { w: number; h: number } }> {
  if (!dataUrl.startsWith("data:image/")) return { dataUrl };
  const mime = dataUrlMime(dataUrl) || "";
  if (mime.includes("svg+xml") || mime.includes("x-icon") || mime.includes("vnd.microsoft.icon")) return { dataUrl };

  const size = await getBitmapSize(dataUrl);
  if (!size) return { dataUrl };
  const { width: w, height: h } = size;
  if (w < 16 || h < 16 || w <= 2 || h <= 2) return { dataUrl, from: { w, h }, to: { w, h } };

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
  if (!img) return { dataUrl };

  const canvas = document.createElement("canvas");
  canvas.width = w - 2;
  canvas.height = h - 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl };
  ctx.imageSmoothingEnabled = true;

  // Crop 1px from each edge to remove common 1px border artifacts in uploaded icons.
  ctx.drawImage(img, 1, 1, w - 2, h - 2, 0, 0, w - 2, h - 2);

  // Use PNG for stability and sharp edges.
  const out = canvas.toDataURL("image/png");
  return { dataUrl: out, from: { w, h }, to: { w: w - 2, h: h - 2 } };
}

export function BrandingCard({
  settings,
  disabled,
  onSettingsSaved
}: {
  settings?: SiteSettings;
  disabled?: boolean;
  onSettingsSaved?: (next: SiteSettings) => void;
}) {
  const reduceMotion = useReducedMotion();
  const initial = useMemo(() => normalizeSiteSettings(settings), [settings]);

  const [siteTitle, setSiteTitle] = useState(initial.siteTitle);
  const [siteSubtitle, setSiteSubtitle] = useState(initial.siteSubtitle);
  const [siteIconDataUrl, setSiteIconDataUrl] = useState(initial.siteIconDataUrl);
  const [faviconDataUrl, setFaviconDataUrl] = useState(initial.faviconDataUrl);
  const [siteIconFit, setSiteIconFit] = useState<SiteSettings["siteIconFit"]>(initial.siteIconFit);

  const [siteIconInfo, setSiteIconInfo] = useState<ImageInfo>({ src: initial.siteIconDataUrl });
  const [faviconInfo, setFaviconInfo] = useState<ImageInfo>({ src: initial.faviconDataUrl });

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSiteTitle(initial.siteTitle);
    setSiteSubtitle(initial.siteSubtitle);
    setSiteIconDataUrl(initial.siteIconDataUrl);
    setFaviconDataUrl(initial.faviconDataUrl);
    setSiteIconFit(initial.siteIconFit);
    setSiteIconInfo({ src: initial.siteIconDataUrl });
    setFaviconInfo({ src: initial.faviconDataUrl });
  }, [initial]);

  useEffect(() => {
    (async () => {
      if (!siteIconDataUrl) return setSiteIconInfo((p) => ({ ...p, src: "" }));
      const s = await getBitmapSize(siteIconDataUrl);
      setSiteIconInfo((p) => ({ ...p, src: siteIconDataUrl, width: s?.width, height: s?.height }));
    })();
  }, [siteIconDataUrl]);

  useEffect(() => {
    (async () => {
      if (!faviconDataUrl) return setFaviconInfo((p) => ({ ...p, src: "" }));
      const s = await getBitmapSize(faviconDataUrl);
      setFaviconInfo((p) => ({ ...p, src: faviconDataUrl, width: s?.width, height: s?.height }));
    })();
  }, [faviconDataUrl]);

  const previewSettings = normalizeSiteSettings({
    siteTitle,
    siteSubtitle,
    siteIconDataUrl,
    faviconDataUrl,
    siteIconFit
  });

  async function onPickSiteIcon(file: File | null) {
    setInlineError(null);
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) return setInlineError(`顶部图标文件过大（${Math.ceil(file.size / 1024)}KB），建议 ≤ 200KB`);
    const raw = await readAsDataUrl(file);
    const trimmed = await trimEdgeDataUrl(raw);
    const dataUrl = trimmed.dataUrl;
    if (!/^data:image\//.test(dataUrl)) return setInlineError("不支持的图片格式");
    const size = await getBitmapSize(dataUrl);
    if (trimmed.from && (trimmed.from.w < 16 || trimmed.from.h < 16)) {
      setInlineError("图片尺寸过小，已跳过自动裁切（建议至少 16×16）");
    }
    setSiteIconDataUrl(dataUrl);
    setSiteIconInfo({
      src: dataUrl,
      bytes: file.size,
      type: file.type,
      name: file.name,
      originalWidth: trimmed.from?.w,
      originalHeight: trimmed.from?.h,
      width: size?.width,
      height: size?.height,
      trimmed: !!trimmed.from && !!trimmed.to && (trimmed.from.w !== trimmed.to.w || trimmed.from.h !== trimmed.to.h)
    });
  }

  async function onPickFavicon(file: File | null) {
    setInlineError(null);
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) return setInlineError(`Favicon 文件过大（${Math.ceil(file.size / 1024)}KB），建议 ≤ 200KB`);
    const dataUrl = await readAsDataUrl(file);
    if (!/^data:image\//.test(dataUrl)) return setInlineError("不支持的图片格式");

    if (!isIco(file)) {
      const size = await getBitmapSize(dataUrl);
      setFaviconInfo({
        src: dataUrl,
        bytes: file.size,
        type: file.type,
        name: file.name,
        width: size?.width,
        height: size?.height
      });
    } else {
      setFaviconInfo({
        src: dataUrl,
        bytes: file.size,
        type: file.type,
        name: file.name
      });
    }

    setFaviconDataUrl(dataUrl);
  }

  async function save() {
    setStatus(null);
    setBusy(true);
    try {
      const res = await api.admin.settings.update(previewSettings);
      setStatus({ kind: "ok", text: "已保存" });
      applyFavicon(res.settings.faviconDataUrl);
      onSettingsSaved?.(res.settings);
    } catch (e: unknown) {
      setStatus({ kind: "error", text: toErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStatus(null);
    setInlineError(null);
    setSiteTitle(DEFAULT_SITE_SETTINGS.siteTitle);
    setSiteSubtitle(DEFAULT_SITE_SETTINGS.siteSubtitle);
    setSiteIconDataUrl(DEFAULT_SITE_SETTINGS.siteIconDataUrl);
    setFaviconDataUrl(DEFAULT_SITE_SETTINGS.faviconDataUrl);
    setSiteIconFit(DEFAULT_SITE_SETTINGS.siteIconFit);
    setSiteIconInfo({ src: "" });
    setFaviconInfo({ src: "" });
    iconInputRef.current && (iconInputRef.current.value = "");
    faviconInputRef.current && (faviconInputRef.current.value = "");
    applyFavicon("");
  }

  function clearSiteIcon() {
    setInlineError(null);
    setSiteIconDataUrl("");
    setSiteIconInfo({ src: "" });
    iconInputRef.current && (iconInputRef.current.value = "");
  }

  function clearFavicon() {
    setInlineError(null);
    setFaviconDataUrl("");
    setFaviconInfo({ src: "" });
    faviconInputRef.current && (faviconInputRef.current.value = "");
    applyFavicon("");
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">站点外观 / Branding</div>
          <div className="text-xs text-muted">上传顶部图标与 favicon（存入 KV 的 Data URL），保存后刷新仍生效。</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-9 px-3"
            leftIcon={<RotateCcw size={18} />}
            onClick={reset}
            disabled={busy || disabled}
          >
            恢复默认
          </Button>
          <Button
            variant="primary"
            className="h-9 px-3"
            leftIcon={<Save size={18} />}
            onClick={save}
            disabled={busy || disabled || !siteTitle.trim() || !siteSubtitle.trim()}
          >
            保存
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <Field label="站点标题" value={siteTitle} onChange={setSiteTitle} placeholder="AppleBar" />
          <Field label="副标题" value={siteSubtitle} onChange={setSiteSubtitle} placeholder="个人导航" />

          <div className="rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-3">
            <div className="text-sm font-medium text-fg/80">图标适配</div>
            <div className="mt-2 inline-flex rounded-2xl border border-white/10 bg-white/6 dark:bg-white/5 p-1">
              <button
                type="button"
                className={
                  "h-9 rounded-xl2 px-4 text-sm font-medium transition " +
                  (siteIconFit === "contain"
                    ? "bg-white/12 dark:bg-white/10 text-fg shadow-[0_10px_24px_rgba(0,0,0,.10)]"
                    : "text-fg/70 hover:text-fg")
                }
                onClick={() => setSiteIconFit("contain")}
              >
                自适应
              </button>
              <button
                type="button"
                className={
                  "h-9 rounded-xl2 px-4 text-sm font-medium transition " +
                  (siteIconFit === "cover"
                    ? "bg-white/12 dark:bg-white/10 text-fg shadow-[0_10px_24px_rgba(0,0,0,.10)]"
                    : "text-fg/70 hover:text-fg")
                }
                onClick={() => setSiteIconFit("cover")}
              >
                填充
              </button>
            </div>
            <div className="mt-2 text-xs text-muted">默认自适应（contain），需要铺满时切换填充（cover）。</div>
          </div>

          <UploadField
            title="顶部图标（圆角方块）"
            hint="建议 ≥ 128×128，≤ 200KB"
            info={siteIconInfo}
            onPick={() => iconInputRef.current?.click()}
            onClear={clearSiteIcon}
          >
            <input
              ref={iconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => onPickSiteIcon(e.target.files?.[0] ?? null)}
            />
          </UploadField>

          <UploadField
            title="Favicon（浏览器 Tab）"
            hint="建议 32×32 或 48×48；ico 优先；≤ 200KB"
            info={faviconInfo}
            onPick={() => faviconInputRef.current?.click()}
            onClear={clearFavicon}
            clearText="恢复默认"
          >
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/webp,image/jpeg"
              className="hidden"
              onChange={(e) => onPickFavicon(e.target.files?.[0] ?? null)}
            />
          </UploadField>

          {inlineError ? (
            <div className="rounded-2xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
              {inlineError}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-3">
            <div className="text-xs font-medium text-fg/80">TopBar 预览</div>
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
              className="mt-3 glass flex items-center justify-between rounded-2xl px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <TopBarIcon src={previewSettings.siteIconDataUrl} fit={previewSettings.siteIconFit} sizeClassName="h-10 w-10" />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">{previewSettings.siteTitle}</div>
                  <div className="truncate text-xs text-muted">{previewSettings.siteSubtitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4" />
                <div className="rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 px-3 py-2 text-xs font-medium">
                  管理
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-fg/80">Favicon 预览</div>
              <TopBarIcon src={previewSettings.faviconDataUrl} fit="cover" sizeClassName="h-9 w-9" />
            </div>
            <div className="mt-2 text-xs text-muted">保存后会动态注入 `&lt;link rel="icon"&gt;`，清除可恢复默认。</div>
          </div>

          {status ? (
            <div
              className={
                "mt-3 rounded-2xl border p-3 text-sm " +
                (status.kind === "ok"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-danger/25 bg-danger/10 text-danger")
              }
            >
              <div className="flex items-center gap-2">
                {status.kind === "ok" ? <Check size={16} /> : <TriangleAlert size={16} />}
                <div className="font-medium">{status.text}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-fg/80">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
        placeholder={placeholder}
      />
    </label>
  );
}

function UploadField({
  title,
  hint,
  info,
  onPick,
  onClear,
  clearText = "清除",
  children
}: {
  title: string;
  hint: string;
  info: ImageInfo;
  onPick: () => void;
  onClear: () => void;
  clearText?: string;
  children: React.ReactNode;
}) {
  const sizeText =
    typeof info.width === "number" && typeof info.height === "number" ? `${info.width}×${info.height}` : "—";
  const sizeTextWithFrom =
    info.trimmed && typeof info.originalWidth === "number" && typeof info.originalHeight === "number" && sizeText !== "—"
      ? `${info.originalWidth}×${info.originalHeight} → ${sizeText}`
      : sizeText;
  const kbText = typeof info.bytes === "number" ? `${Math.ceil(info.bytes / 1024)}KB` : "—";
  const has = !!info.src.trim();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4 p-3">
      {children}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg/80">{title}</div>
          <div className="mt-1 text-xs text-muted">{hint}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-white/10 bg-white/6 dark:bg-white/5 px-2 py-0.5">尺寸 {sizeTextWithFrom}</span>
            <span className="rounded-full border border-white/10 bg-white/6 dark:bg-white/5 px-2 py-0.5">大小 {kbText}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SquareIcon src={info.src} size="md" />
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="h-9 px-3" leftIcon={<Upload size={18} />} onClick={onPick}>
              上传
            </Button>
            <Button
              variant="ghost"
              className="h-9 px-3"
              leftIcon={<Eraser size={18} />}
              onClick={onClear}
              disabled={!has}
            >
              {clearText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SquareIcon({ src, size }: { src: string; size: "sm" | "md" }) {
  return <TopBarIcon src={src} fit="cover" sizeClassName={size === "sm" ? "h-9 w-9" : "h-10 w-10"} />;
}
