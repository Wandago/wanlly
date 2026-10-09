"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * A small per-browser setting (an open panel, a chosen tab) kept in localStorage. The server and
 * the first render use the fallback, then the saved value takes over without a hydration mismatch.
 */

const EVENT = "wanlly-local-setting";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalSetting(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => read(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
