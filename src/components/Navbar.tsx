import { Laptop2, Moon, Settings, Sun, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeSiteSettings } from "../lib/siteSettings";
import { useTheme } from "../lib/theme";
import type { SiteSettings } from "../types";
import { Button } from "./Button";
import { TopBarIcon } from "./TopBarIcon";

export function Navbar({ authed, settings }: { authed: boolean; settings?: SiteSettings }) {
  const reduceMotion = useReducedMotion();
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const currentIcon =
    mode === "system" ? <Laptop2 size={18} /> : resolved === "dark" ? <Moon size={18} /> : <Sun size={18} />;

  const s = useMemo(() => normalizeSiteSettings(settings), [settings]);

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
            <div className="relative">
              <Button
                variant="ghost"
                className="h-10 px-3"
                aria-label="Theme"
                onClick={() => setOpen((v) => !v)}
                leftIcon={currentIcon}
              >
                {mode === "system" ? "系统" : resolved === "dark" ? "深色" : "浅色"}
              </Button>
              <AnimatePresence>
                {open ? (
                  <motion.div
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                    transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute right-0 mt-2 w-44 rounded-2xl glass-strong p-2 shadow-[0_30px_90px_rgba(0,0,0,.18)] dark:shadow-[0_30px_110px_rgba(0,0,0,.55)]"
                  >
                    <div className="space-y-1">
                      <Button
                        variant={mode === "system" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        leftIcon={<Laptop2 size={18} />}
                        onClick={() => {
                          setMode("system");
                          setOpen(false);
                        }}
                      >
                        系统
                      </Button>
                      <Button
                        variant={mode === "light" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        leftIcon={<Sun size={18} />}
                        onClick={() => {
                          setMode("light");
                          setOpen(false);
                        }}
                      >
                        浅色
                      </Button>
                      <Button
                        variant={mode === "dark" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        leftIcon={<Moon size={18} />}
                        onClick={() => {
                          setMode("dark");
                          setOpen(false);
                        }}
                      >
                        深色
                      </Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

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
