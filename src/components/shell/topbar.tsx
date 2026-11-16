import Link from "next/link";
import { Bell, Search, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui";
import { fmtShort, todayLabel } from "@/lib/format";
import { logout } from "@/app/login/actions";
import { markAllRead } from "@/app/(main)/notifications/actions";
import { Dropdown } from "./dropdown";
import { MenuButton, SearchShortcut } from "./topbar-client";

type Props = {
  name: string;
  initials: string;
  subtitle: string;
  unread: number;
  notifications: { id: string; message: string; isRead: boolean; createdAt: Date; documentId: string | null }[];
};

export function Topbar({ name, initials, subtitle, unread, notifications }: Props) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:gap-6 lg:px-8">
      <MenuButton />
      <form action="/documents" role="search" className="relative w-full max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input id="global-search" name="q" aria-label="Баримт хайх" placeholder="Дугаар, гарчиг, ажилтнаар хайх…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-sm outline-none focus:border-navy-600 focus:bg-white" />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-500 md:block" title="Хайлт руу шилжих товч">/</kbd>
        <SearchShortcut />
      </form>

      <div className="ml-auto flex items-center gap-3 sm:gap-6">
        <span className="hidden text-sm text-slate-600 lg:inline">{todayLabel()}</span>

        <Dropdown
          trigger={
            <span className="relative flex cursor-pointer items-center rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900" title="Мэдэгдэл">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>
              )}
            </span>
          }
        >
          <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold">Мэдэгдэл</span>
              {unread > 0 && (
                <form action={markAllRead}>
                  <button className="link text-xs">Бүгдийг уншсан болгох</button>
                </form>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {notifications.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Мэдэгдэл алга</li>}
              {notifications.map((n) => (
                <li key={n.id} className={n.isRead ? "" : "bg-navy-50/50"}>
                  {/* Дарахад уншсан болж, баримт руу шилжинэ */}
                  <a href={`/api/notifications/${n.id}`} className="flex gap-2.5 px-4 py-3 text-sm hover:bg-slate-50">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-red-500"}`} />
                    <span>
                      <span className="block text-slate-800">{n.message}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{fmtShort(n.createdAt)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <Link href="/notifications" className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-navy-700 hover:bg-slate-50">Бүгдийг харах</Link>
          </div>
        </Dropdown>

        <Dropdown
          trigger={
            <span className="flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-100">
              <Avatar text={initials} />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold text-slate-900">{name}</span>
                <span className="block text-xs text-slate-500">{subtitle}</span>
              </span>
            </span>
          }
        >
          <div className="absolute right-0 mt-3 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <form action={logout}>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <LogOut size={16} /> Гарах
              </button>
            </form>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}
