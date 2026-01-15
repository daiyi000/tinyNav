import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "applebar:theme";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function readStoredMode(): ThemeMode {
  try {
    const stored = (localStorage.getItem(STORAGE_KEY) || "system") as ThemeMode;
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => (typeof window === "undefined" ? "system" : readStoredMode()));
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "light";
    const initialMode = readStoredMode();
    return initialMode === "system" ? getSystemTheme() : initialMode;
  });

  // Apply before paint to avoid a flash and to keep UI transitions consistent from first interaction.
  useLayoutEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (mode !== "system" || !window.matchMedia) return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(mql.matches ? "dark" : "light");
    onChange();
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setResolved(next === "system" ? getSystemTheme() : next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

