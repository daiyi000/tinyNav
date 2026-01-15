import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MobileSearchFAB({
  value,
  onChange
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const transition = reduceMotion ? { duration: 0.16 } : { type: "spring", stiffness: 600, damping: 45, mass: 0.8 };

  return (
    <div className="sm:hidden">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px] dark:bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0.16 } : { duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div
        className="fixed z-[60]"
        style={{ right: 16, bottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div
              key="open"
              layoutId="fabSearch"
              className="glass flex h-14 w-[calc(100vw-32px)] max-w-[520px] items-center gap-2 rounded-full border border-white/20 bg-white/55 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={transition}
              onClick={(e) => e.stopPropagation()}
            >
              <Search size={20} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="搜索…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/80"
              />

              {value ? (
                <button
                  type="button"
                  aria-label="Clear"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:text-fg hover:bg-white/8 dark:hover:bg-white/10"
                  onClick={() => onChange("")}
                >
                  <XCircle size={18} />
                </button>
              ) : null}

              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-fg/80 transition hover:text-fg hover:bg-white/8 dark:hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="closed"
              layoutId="fabSearch"
              type="button"
              aria-label="Open search"
              className="glass inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/55 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10"
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={transition}
              onClick={() => setOpen(true)}
            >
              <Search size={22} className="text-fg/80" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

