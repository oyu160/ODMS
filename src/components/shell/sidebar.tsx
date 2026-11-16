"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid, FileText, CircleCheck, UserPlus, Archive, BarChart3, Settings, Users, Lock, Clock, FileStack, X } from "lucide-react";

/** Жижиг дэлгэцэд (утас, таблет) цэсийг нээх/хаах — Topbar-ын цэсний товч энэ үйл явдлыг дуудна */
export const SIDEBAR_TOGGLE = "dms:sidebar-toggle";

const ICONS = { LayoutGrid, FileText, CircleCheck, UserPlus, Archive, BarChart3, Settings, Users, Lock, Clock };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; danger?: boolean };

export function Sidebar({ main, admin }: { main: NavItem[]; admin: NavItem[] }) {
  const path = usePathname();
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
  const isActive = (href: string) => path === href || (href !== "/dashboard" && path.startsWith(href + "/")) || path === href;

  const render = (items: NavItem[]) =>
    items.map((it) => {
      const Icon = ICONS[it.icon];
      const active = isActive(it.href);
      return (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${active ? "bg-navy-50 font-semibold text-navy-900" : "text-slate-700 hover:bg-slate-50"}`}
        >
          <Icon size={18} strokeWidth={1.8} />
          <span className="flex-1 leading-tight">{it.label}</span>
          {!!it.badge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${it.danger ? "bg-red-600" : "bg-navy-800"}`}>{it.badge}</span>
          )}
        </Link>
      );
    });

  return (
    <>
    {open && <div className="no-print fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
    <aside
      aria-label="Үндсэн цэс"
      className={`no-print fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 shadow-xl transition-transform lg:sticky lg:top-0 lg:w-64 lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden" aria-label="Цэс хаах"><X size={18} /></button>
      <Link href="/dashboard" className="mb-8 flex items-start gap-3 px-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-white">
          <FileStack size={20} />
        </span>
        <span>
          <span className="block text-[15px] font-bold leading-snug text-slate-900">Баримт бичгийн удирдлагын систем</span>
          <span className="text-xs text-slate-500">[Байгууллагын нэр]</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {main.length > 0 && <div className="px-3 pb-2 text-xs font-semibold tracking-wider text-slate-400">ҮНДСЭН</div>}
        {render(main)}
        {admin.length > 0 && <div className="px-3 pb-2 pt-6 text-xs font-semibold tracking-wider text-slate-400">ТОХИРГОО</div>}
        {render(admin)}
      </nav>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="font-semibold text-slate-900">Тусламж хэрэгтэй юу?</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-500">Мэдээллийн технологийн хэлтэс<br />Дотоод утас: [дугаар]</div>
      </div>
    </aside>
    </>
  );
}
