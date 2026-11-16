// Нийтлэг UI хэсгүүд (дипломын 3.2-ын зохиомжийн дагуу)
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";

export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs: [string, string?][];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <nav aria-label="Байршил" className="mb-2 text-xs text-slate-500">
          {[["Нүүр", "/dashboard"] as [string, string?], ...crumbs].map(([label, href], i, arr) => (
            <span key={i}>
              {href && i < arr.length - 1 ? <Link href={href} className="hover:text-slate-800">{label}</Link> : label}
              {i < arr.length - 1 && " / "}
            </span>
          ))}
        </nav>
        <h1 className="text-2xl font-bold sm:text-[28px] leading-tight tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = "" }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {right && <div className="text-sm">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "default", icon, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "default" | "danger"; icon?: React.ReactNode; href?: string }) {
  const danger = tone === "danger";
  const cls = `block rounded-xl border p-5 transition ${danger ? "border-red-200 bg-red-50/60" : "border-slate-200 bg-white"} ${href ? (danger ? "hover:border-red-400 hover:shadow-sm" : "hover:border-navy-600 hover:shadow-sm") : ""}`;
  const body = (
    <>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        {icon ? <span className={danger ? "text-red-600" : "text-slate-400"}>{icon}</span> : href ? <ArrowUpRight size={16} className="text-slate-400" /> : null}
      </div>
      <div className={`mt-2 text-3xl font-bold ${danger ? "text-red-700" : "text-slate-900"}`}>{value}</div>
      {hint && <div className={`mt-1 text-xs ${danger ? "text-red-700" : "text-slate-500"}`}>{hint}</div>}
    </>
  );
  // href өгвөл карт дээр дарахад тухайн жагсаалт шүүгдэж гарна
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  RETURNED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-sky-100 text-sky-800",
  REGISTERED: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-indigo-100 text-indigo-800",
  RESOLVED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
};
export const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#cbd5e1",
  IN_REVIEW: "#f59e0b",
  RETURNED: "#f97316",
  APPROVED: "#60a5fa",
  REGISTERED: "#2563eb",
  ASSIGNED: "#6366f1",
  RESOLVED: "#16a34a",
  ARCHIVED: "#475569",
  CANCELLED: "#dc2626",
};

export function StatusBadge({ code, name }: { code: string; name: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[code] ?? "bg-slate-100"}`}>{name}</span>;
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "amber" | "green" | "navy" }) {
  const t = { slate: "bg-slate-100 text-slate-700", red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800", green: "bg-green-100 text-green-800", navy: "bg-navy-50 text-navy-800" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-slate-500">{text}</td>
    </tr>
  );
}

/** Холбоос дээр суурилсан таб */
export function Tabs({ tabs, active }: { tabs: { key: string; label: React.ReactNode; href: string }[]; active: string }) {
  return (
    <div className="mb-5 flex gap-6 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px border-b-2 pb-3 text-sm font-medium ${t.key === active ? "border-navy-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Дугаартай хуудаслалт: 1 2 3 … 13 */
export function Pagination({ page, pages, total, from, to, href }: { page: number; pages: number; total: number; from: number; to: number; href: (p: number) => string }) {
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);
  const cls = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>{total === 0 ? "Илэрц алга" : `${total}-аас ${from}–${to} харуулж байна`}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          {page > 1 ? <Link href={href(page - 1)} className={`${cls} border-slate-300 bg-white text-slate-700`}><ChevronLeft size={14} /> Өмнөх</Link> : null}
          {nums.map((n, i) => (
            <span key={n} className="flex items-center gap-1.5">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}
              <Link href={href(n)} className={`${cls} ${n === page ? "border-navy-800 bg-navy-800 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{n}</Link>
            </span>
          ))}
          {page < pages ? <Link href={href(page + 1)} className={`${cls} border-slate-300 bg-white text-slate-700`}>Дараах <ChevronRight size={14} /></Link> : null}
        </div>
      )}
    </div>
  );
}

export function Avatar({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy-800 font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {text}
    </span>
  );
}

/** URL хайлтын параметр бүтээгч */
export function makeHref(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...params, ...patch };
  const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `${base}?${qs}` : base;
}
