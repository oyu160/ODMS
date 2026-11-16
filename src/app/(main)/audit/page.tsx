import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { AUDIT_LABELS } from "@/lib/workflow";
import { fmtDateTime, shortName } from "@/lib/format";
import { PageHeader, Pagination, EmptyRow, StatusBadge, makeHref } from "@/components/ui";

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

  return (
    <div>
      <PageHeader crumbs={[["Тохиргоо"], ["Үйлдлийн бүртгэл"]]} title="Үйлдлийн бүртгэл" subtitle="Системд хийгдсэн бүх үйлдэл (audit_logs) — өөрчлөх, устгах боломжгүй" />
      <form className="card mb-5 grid gap-4 p-5 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
        <div>
          <label className="label text-xs">Хэрэглэгч</label>
          <select name="user" defaultValue={sp.user ?? ""} className="input"><option value="">Бүгд</option>{users.map((u) => <option key={u.id} value={u.id}>{shortName(u.employee)} ({u.username})</option>)}</select>
        </div>
        <div>
          <label className="label text-xs">Үйлдэл</label>
          <select name="action" defaultValue={sp.action ?? ""} className="input"><option value="">Бүгд</option>{actions.map((a) => <option key={a.action} value={a.action}>{AUDIT_LABELS[a.action] ?? a.action}</option>)}</select>
        </div>
        <div><label className="label text-xs">Эхлэх</label><input type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label text-xs">Дуусах</label><input type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <button className="btn-primary">Шүүх</button>
      </form>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/60"><tr><th className="th">Огноо</th><th className="th">Хэрэглэгч</th><th className="th">Үйлдэл</th><th className="th">Объект</th><th className="th">Шинэ төлөв</th><th className="th">Дэлгэрэнгүй</th><th className="th">IP</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap text-slate-600">{fmtDateTime(l.createdAt)}</td>
                <td className="td">{shortName(l.user.employee)}</td>
                <td className="td font-medium">{AUDIT_LABELS[l.action] ?? l.action}</td>
                <td className="td">{l.document ? <Link href={`/documents/${l.document.id}`} className="link">{l.document.documentNumber ?? l.document.internalNumber}</Link> : <span className="text-slate-500">{l.entityType}</span>}</td>
                <td className="td">{l.newStatus ? <StatusBadge code={l.newStatus.code} name={l.newStatus.name} /> : "—"}</td>
                <td className="td max-w-72 truncate text-xs text-slate-500">{l.newValue ? JSON.stringify(l.newValue) : ""}</td>
                <td className="td font-mono text-xs text-slate-500">{l.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && <EmptyRow cols={7} text="Бичлэг олдсонгүй" />}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} total={total} from={(page - 1) * PAGE_SIZE + 1} to={Math.min(total, page * PAGE_SIZE)} href={(p) => makeHref("/audit", sp, { page: String(p) })} />
      </div>
    </div>
  );
}
