"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type AccentColor = "blue" | "yellow" | "red" | "green" | "orange" | "purple";

export const ACCENT_COLORS: { key: AccentColor; label: string; swatch: string }[] = [
  { key: "blue",   label: "Blue",   swatch: "#7c9cff" },
  { key: "yellow", label: "Yellow", swatch: "#f0c45a" },
  { key: "red",    label: "Red",    swatch: "#f07070" },
  { key: "green",  label: "Green",  swatch: "#5cd4a0" },
  { key: "orange", label: "Orange", swatch: "#f0945a" },
  { key: "purple", label: "Purple", swatch: "#b07cff" },
];

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentColor;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  accent: "blue",
  setMode: () => {},
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getStoredValue<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return (localStorage.getItem(key) as T) || fallback;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<AccentColor>("blue");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setModeState(getStoredValue("tcg-theme-mode", "dark"));
    setAccentState(getStoredValue("tcg-theme-accent", "blue"));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("tcg-theme-mode", mode);
  }, [mode, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("tcg-theme-accent", accent);
  }, [accent, mounted]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setAccent = useCallback((a: AccentColor) => setAccentState(a), []);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
