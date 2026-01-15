import { Laptop2, Moon, Settings, Sun, User } from "lucide-react";
import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeSiteSettings } from "../lib/siteSettings";
import { useTheme } from "../lib/theme";
import type { SiteSettings } from "../types";
import { Button } from "./Button";
import { TopBarIcon } from "./TopBarIcon";

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(mql.matches);
    onChange();
    try {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    } catch {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  return reduce;
}

export function Navbar({ authed, settings }: { authed: boolean; settings?: SiteSettings }) {
  const reduceMotion = usePrefersReducedMotion();
  const { mode, resolved, setMode } = useTheme();
  const iconControls = useAnimationControls();
  const [animTick, setAnimTick] = useState(0);
  const lastAnimatedTickRef = useRef(0);

  const s = useMemo(() => normalizeSiteSettings(settings), [settings]);

  useEffect(() => {
    document.title = s.siteTitle || "TinyNav";
  }, [s.siteTitle]);

  useEffect(() => {
    if (animTick === 0) return;
    if (lastAnimatedTickRef.current === animTick) return;
    lastAnimatedTickRef.current = animTick;

    iconControls.stop();

    if (reduceMotion) {
      void iconControls.start({ opacity: [0.7, 1], transition: { duration: 0.16, ease: "easeOut" } });
      return;
    }

    iconControls.set({ rotate: 0, scale: 1, opacity: 1 });

    if (mode === "dark") {
      void iconControls.start({
        rotate: [0, 270, 360],
        scale: [1, 1.04, 1],
        transition: {
          rotate: { duration: 0.62, ease: "easeInOut" },
          scale: { duration: 0.5, ease: "easeOut" }
        }
      });
      return;
    }

    if (mode === "light") {
      void iconControls.start({
        scale: [1, 1.24, 0.98, 1.18, 1],
        transition: { duration: 0.72, ease: "easeOut" }
      });
      return;
    }

    const rotate = resolved === "dark" ? [0, 14, -10, 0] : [0, -12, 10, 0];
    void iconControls.start({
      rotate,
      scale: [1, 1.08, 1],
      transition: { duration: 0.55, ease: "easeOut" }
    });
  }, [animTick, iconControls, mode, reduceMotion, resolved]);

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="glass flex items-center justify-between rounded-2xl px-4 py-3 shadow-soft dark:shadow-softDark">
          <Link
            to="/"
            aria-label="Go to home"
            className="group -ml-2 rounded-2xl px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          >
            <motion.div
              className="flex items-center gap-3 rounded-2xl transition-colors group-hover:bg-white/6 dark:group-hover:bg-white/6"
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
            >
              <TopBarIcon src={s.siteIconDataUrl} fit={s.siteIconFit} sizeClassName="h-9 w-9" />
              <div className="leading-tight">
                <div className="text-sm font-semibold">{s.siteTitle}</div>
                <div className="text-xs text-muted">{s.siteSubtitle}</div>
              </div>
            </motion.div>
          </Link>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              aria-label={mode === "system" ? "系统" : mode === "dark" ? "深色" : "浅色"}
              onClick={() => {
                const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
                setMode(next);
                setAnimTick((t) => t + 1);
              }}
              className={
                "glass inline-flex h-10 w-10 items-center justify-center rounded-xl2 px-0 text-fg/80 " +
                "transition-[box-shadow,transform,background,border-color,opacity] select-none " +
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
                "hover:text-fg hover:bg-white/6 dark:hover:bg-white/8"
              }
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <motion.span className="inline-flex" animate={iconControls} initial={false}>
                {mode === "dark" ? <Moon size={20} /> : mode === "light" ? <Sun size={20} /> : <Laptop2 size={20} />}
              </motion.span>
            </motion.button>

            {authed ? (
              <Link to="/admin">
                <Button variant="secondary" leftIcon={<Settings size={18} />}>
                  管理
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button variant="ghost" leftIcon={<User size={18} />}>
                  登录
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
