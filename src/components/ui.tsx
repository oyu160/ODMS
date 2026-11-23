// Niitleg UI hesguud (diplomiin 3.2-iin zohiomjiin daguu)
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";

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
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
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
        {icon ? <span className={danger ? "text-red-600" : "text-slate-500"}>{icon}</span> : href ? <ArrowUpRight size={16} className="text-slate-500" /> : null}
      </div>
      <div className={`mt-2 text-3xl font-bold ${danger ? "text-red-700" : "text-slate-900"}`}>{value}</div>
      {hint && <div className={`mt-1 text-xs ${danger ? "text-red-700" : "text-slate-500"}`}>{hint}</div>}
    </>
  );
  // href ugwul kart deer darahad tuhain jagsaalt shuugdej garna
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  RETURNED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-teal-100 text-teal-800",
  REGISTERED: "bg-blue-100 text-blue-800",
  SENT: "bg-cyan-100 text-cyan-800",
  ASSIGNED: "bg-violet-100 text-violet-800",
  RESOLVED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
};
/** Tuluw buriin undsen ungu — grafik, tseg, tuuhend. Batlagdsan / Burtgegdsen / Huwaarilagdsan ni teal / blue / violet tul tod yalgagdana */
export const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#94a3b8",
  IN_REVIEW: "#d97706",
  RETURNED: "#ea580c",
  APPROVED: "#0d9488",
  REGISTERED: "#2563eb",
  SENT: "#0891b2",
  ASSIGNED: "#7c3aed",
  RESOLVED: "#16a34a",
  ARCHIVED: "#475569",
  CANCELLED: "#dc2626",
};

/** Barimtiin tuluw: ungut temdeg + tseg (ungunuus gadna helbereer ch yalgagdana) */
export function StatusBadge({ code, name }: { code: string; name: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[code] ?? "bg-slate-100 text-slate-700"}`}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[code] ?? "#94a3b8" }} />
      {name}
    </span>
  );
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "amber" | "orange" | "green" | "navy" | "violet" | "teal" }) {
  const t = { slate: "bg-slate-100 text-slate-700", red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800", orange: "bg-orange-100 text-orange-800", green: "bg-green-100 text-green-800", navy: "bg-navy-50 text-navy-800", violet: "bg-violet-100 text-violet-800", teal: "bg-teal-100 text-teal-800" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function EmptyRow({ cols, text, action }: { cols: number; text: string; action?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-slate-500">
        {text}
        {action && <div className="mt-3">{action}</div>}
      </td>
    </tr>
  );
}

/** Holboos deer suurilsan tab */
export function Tabs({ tabs, active }: { tabs: { key: string; label: React.ReactNode; href: string }[]; active: string }) {
  return (
    <nav className="mb-5 flex gap-6 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm ${t.key === active ? "border-navy-700 font-semibold text-slate-900" : "border-transparent font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Dugaartai huudaslalt: 1 2 3 … 13 */
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

export function Avatar({ text, size = 40, src }: { text: string; size?: number; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={text} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-navy-800 font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {text}
    </span>
  );
}

/** URL hailtiin parametr buteegch */
export function makeHref(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...params, ...patch };
  const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `${base}?${qs}` : base;
}

/** Erembeleh bolomjtoi baganiin tolgoi: darahad usuh ↔ buurah daraallaar soligdono */
export function SortTh({ label, active, dir, href, className = "" }: { label: string; active: boolean; dir: "asc" | "desc"; href: string; className?: string }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`th ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className={`inline-flex items-center gap-1 rounded hover:text-slate-900 ${active ? "text-slate-900" : ""}`}>
        {label}
        <Icon size={13} aria-hidden className={active ? "text-navy-700" : "text-slate-500"} />
      </Link>
    </th>
  );
}

/** Idewhtei shuultuuriin shoshgo — × darahad tuhain shuultuur arilna */
export function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 py-1 pl-3 pr-2 text-xs font-semibold text-navy-800 hover:bg-navy-100" aria-label={`${label} — шүүлтүүрийг арилгах`}>
      {label}
      <X size={12} aria-hidden />
    </Link>
  );
}
