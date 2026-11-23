"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, FileText, CircleCheck, UserPlus, Archive, BarChart3, Settings, Users, Lock, Clock, Inbox, Send, FolderOpen, X } from "lucide-react";
import { Logo } from "@/components/logo";

/** Jijig delgetsed (utas, tablet) tsesiig neeh/haah — Topbar-iin tsesnii towch ene uil yawdliig duudna */
export const SIDEBAR_TOGGLE = "dms:sidebar-toggle";

const ICONS = { LayoutGrid, FileText, CircleCheck, UserPlus, Archive, BarChart3, Settings, Users, Lock, Clock, Inbox, Send, FolderOpen };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; danger?: boolean; count?: number };

export function Sidebar({ main, folders, admin, orgName, help }: { main: NavItem[]; folders: NavItem[]; admin: NavItem[]; orgName: string; help: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const dir = sp.get("direction");
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener(SIDEBAR_TOGGLE, toggle);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SIDEBAR_TOGGLE, toggle);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const isActive = (href: string) => {
    // Hawtas: /documents?direction=X — chiglel taarsan ued idewhtei
    const [p, q] = href.split("?");
    if (q) return path === p && dir === new URLSearchParams(q).get("direction");
    if (href === "/documents" && dir) return false;
    return path === href || (href !== "/dashboard" && path.startsWith(href + "/"));
  };

  const render = (items: NavItem[]) =>
    items.map((it) => {
      const Icon = ICONS[it.icon];
      const active = isActive(it.href);
      return (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-navy-50 font-semibold text-navy-800" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}
        >
          <Icon size={18} strokeWidth={1.8} />
          <span className="flex-1 leading-tight">{it.label}</span>
          {it.count !== undefined && !it.badge && <span className="text-xs tabular-nums text-slate-500">{it.count}</span>}
          {!!it.badge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${it.danger ? "bg-red-600" : "!font-semibold !text-navy-800 bg-white ring-1 ring-inset ring-navy-200"}`}>{it.badge}</span>
          )}
        </Link>
      );
    });

  return (
    <>
    {open && <div className="no-print fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
    <aside
      aria-label="Үндсэн цэс"
      className={`no-print fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 px-4 py-6 shadow-xl transition-transform lg:sticky lg:top-0 lg:w-64 lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Цэс хаах"><X size={18} /></button>
      <Link href="/dashboard" className="mb-8 flex items-start gap-3 px-1">
        <Logo size={44} />
        <span>
          <span className="block text-sm font-bold leading-snug text-slate-900">Баримт бичгийн удирдлагын систем</span>
          <span className="text-xs text-slate-500">{orgName}</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {main.length > 0 && <div className="px-3 pb-2 text-xs font-semibold tracking-wider text-slate-500">ҮНДСЭН</div>}
        {render(main)}
        {folders.length > 0 && <div className="px-3 pb-2 pt-6 text-xs font-semibold tracking-wider text-slate-500">ХАВТАС</div>}
        {render(folders)}
        {admin.length > 0 && <div className="px-3 pb-2 pt-6 text-xs font-semibold tracking-wider text-slate-500">ТОХИРГОО</div>}
        {render(admin)}
      </nav>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div className="font-semibold text-slate-900">Тусламж хэрэгтэй юу?</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-500">{help}</div>
      </div>
    </aside>
    </>
  );
}
