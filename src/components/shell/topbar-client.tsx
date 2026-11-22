"use client";

import { useEffect } from "react";
import { Menu } from "lucide-react";
import { SIDEBAR_TOGGLE } from "./sidebar";

/** Jijig delgetsed tsesiig neeh towch */
export function MenuButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(SIDEBAR_TOGGLE))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Цэс нээх">
      <Menu size={20} />
    </button>
  );
}

/** «/» towch darahad hailtiin talbar ruu shiljine (mayagt bugluj baih ued ajillahgui) */
export function SearchShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      document.getElementById("global-search")?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
