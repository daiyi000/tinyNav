import { motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import type { Ref } from "react";

export function SearchBar({
  value,
  onChange,
  placeholder = "搜索 标题/描述/URL…",
  autoFocus,
  inputRef,
  className
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={
        "glass flex items-center gap-2 rounded-2xl px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,.10)] " +
        (className ?? "")
      }
      layout
      transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
    >
      <Search size={18} className="text-muted" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted/80"
      />
      {value ? (
        <button aria-label="Clear" className="text-muted transition-colors hover:text-fg" onClick={() => onChange("")}>
          <X size={18} />
        </button>
      ) : null}
    </motion.div>
  );
}
