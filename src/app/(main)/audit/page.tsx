import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { AUDIT_LABELS } from "@/lib/workflow";
import { fmtDateTime, shortName, describeAuditValue, ENTITY_LABELS } from "@/lib/format";
import { PageHeader, Pagination, EmptyRow, StatusBadge, FilterChip, makeHref } from "@/components/ui";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

type SP = Promise<Record<string, string | undefined>>;

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const and: Prisma.AuditLogWhereInput[] = [];
  if (sp.user) and.push({ userId: sp.user });
  if (sp.action) and.push({ action: sp.action });
  if (sp.from) and.push({ createdAt: { gte: new Date(`${sp.from}T00:00:00+08:00`) } });
  if (sp.to) and.push({ createdAt: { lte: new Date(`${sp.to}T23:59:59+08:00`) } });
  const where: Prisma.AuditLogWhereInput = { AND: and };

  const [total, logs, users, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { include: { employee: true } }, document: true, newStatus: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.findMany({ include: { employee: true }, orderBy: { username: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const without = (...keys: string[]) => makeHref("/audit", sp, Object.fromEntries([...keys, "page"].map((k) => [k, undefined])));
  const selUser = users.find((u) => u.id === sp.user);
  const chips = [
    ...(selUser ? [{ label: `Хэрэглэгч: ${shortName(selUser.employee)}`, href: without("user") }] : []),
    ...(sp.action ? [{ label: `Үйлдэл: ${AUDIT_LABELS[sp.action] ?? sp.action}`, href: without("action") }] : []),
    ...(sp.from || sp.to ? [{ label: `Огноо: ${sp.from ?? "…"} – ${sp.to ?? "…"}`, href: without("from", "to") }] : []),
  ];

  return (
    <div>
      <PageHeader crumbs={[["Тохиргоо"], ["Үйлдлийн бүртгэл"]]} title="Үйлдлийн бүртгэл" subtitle="Системд хийгдсэн бүх үйлдэл. Бичлэгийг өөрчлөх, устгах боломжгүй." />
      <form className="card mb-5 space-y-4 p-5" role="search" aria-label="Бүртгэл шүүх">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
          <div>
            <label className="label" htmlFor="a-user">Хэрэглэгч</label>
            <select id="a-user" name="user" defaultValue={sp.user ?? ""} className="input"><option value="">Бүгд</option>{users.map((u) => <option key={u.id} value={u.id}>{shortName(u.employee)} ({u.username})</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="a-action">Үйлдэл</label>
            <select id="a-action" name="action" defaultValue={sp.action ?? ""} className="input"><option value="">Бүгд</option>{actions.map((a) => <option key={a.action} value={a.action}>{AUDIT_LABELS[a.action] ?? a.action}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="a-from">Эхлэх огноо</label><input id="a-from" type="date" name="from" defaultValue={sp.from} className="input" /></div>
          <div><label className="label" htmlFor="a-to">Дуусах огноо</label><input id="a-to" type="date" name="to" defaultValue={sp.to} className="input" /></div>
          <button className="btn-primary">Шүүх</button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">Идэвхтэй шүүлтүүр:</span>
            {chips.map((c) => <FilterChip key={c.label} label={c.label} href={c.href} />)}
            <Link href="/audit" className="text-xs font-semibold text-navy-700 hover:underline">Бүгдийг арилгах</Link>
          </div>
        )}
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60"><tr><th className="th">Огноо</th><th className="th">Хэрэглэгч</th><th className="th">Үйлдэл</th><th className="th">Объект</th><th className="th">Шинэ төлөв</th><th className="th">Дэлгэрэнгүй</th><th className="th">IP</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => {
                const details = describeAuditValue(l.newValue);
                return (
                  <tr key={l.id} className="align-top hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap text-slate-600">{fmtDateTime(l.createdAt)}</td>
                    <td className="td whitespace-nowrap">{shortName(l.user.employee)}</td>
                    <td className="td whitespace-nowrap font-medium">{AUDIT_LABELS[l.action] ?? l.action}</td>
                    <td className="td">
                      {l.document ? (
                        <Link href={`/documents/${l.document.id}`} className="link whitespace-nowrap">{l.document.documentNumber ?? l.document.internalNumber}</Link>
                      ) : (
                        <span className="text-slate-600">{ENTITY_LABELS[l.entityType] ?? l.entityType}</span>
                      )}
                    </td>
                    <td className="td">{l.newStatus ? <StatusBadge code={l.newStatus.code} name={l.newStatus.name} /> : <span className="text-slate-500">—</span>}</td>
                    <td className="td max-w-md">
                      {details.length === 0 ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <dl className="space-y-0.5 text-xs">
                          {details.map((d, i) => (
                            <div key={i} className="flex gap-1.5">
                              <dt className="shrink-0 text-slate-500">{d.label}:</dt>
                              <dd className="line-clamp-2 text-slate-800" title={d.value}>{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                    <td className="td whitespace-nowrap font-mono text-xs text-slate-500">{l.ipAddress ?? "—"}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && <EmptyRow cols={7} text="Бичлэг олдсонгүй." action={chips.length ? <Link href="/audit" className="link text-sm">Шүүлтүүрийг арилгах</Link> : undefined} />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} from={(page - 1) * PAGE_SIZE + 1} to={Math.min(total, page * PAGE_SIZE)} href={(p) => makeHref("/audit", sp, { page: String(p) })} />
      </div>
    </div>
  );
}
