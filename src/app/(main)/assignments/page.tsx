import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { documentScope } from "@/lib/access";
import { fmtShort, shortName, startOfToday, daysBetween, ASSIGNMENT_LABELS } from "@/lib/format";
import { PageHeader, StatCard, Tabs, Pagination, EmptyRow, Pill, FilterChip, makeHref } from "@/components/ui";
import { remind } from "../documents/[id]/actions";
import { SubmitButton } from "@/components/feedback";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

type SP = Promise<Record<string, string | undefined>>;

export default async function AssignmentsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const manager = can(user, "document.assign");
  // Huwaarilaltad oroltsdoggui hereglegch (jish: Admin) ene huudsiig harahgui
  if (!manager && !can(user, "document.resolve")) forbidden();
  const tab = sp.tab ?? (manager ? "all" : "mine");
  const page = Math.max(1, Number(sp.page) || 1);
  const today = startOfToday();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const toMe: Prisma.AssignmentWhereInput = { OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] };
  const base: Prisma.AssignmentWhereInput = manager ? { document: documentScope(user) } : toMe;

  const and: Prisma.AssignmentWhereInput[] = [base];
  if (tab === "byme") and.push({ assignedById: user.id });
  if (tab === "mine") and.push(toMe);
  if (sp.q) and.push({ document: { OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { documentNumber: { contains: sp.q, mode: "insensitive" } }] } });
  if (sp.assignee?.startsWith("u:")) and.push({ assigneeUserId: sp.assignee.slice(2) });
  if (sp.assignee?.startsWith("d:")) and.push({ assigneeDepartmentId: sp.assignee.slice(2) });
  if (sp.status) and.push({ status: sp.status });
  if (sp.due === "overdue") and.push({ status: "ACTIVE", dueDate: { lt: today } });
  if (sp.due === "week") and.push({ status: "ACTIVE", dueDate: { gte: today, lte: in7 } });
  const where: Prisma.AssignmentWhereInput = { AND: and };

  const [open, overdue, week, doneMonth, onTimeMonth, mineCount, total, rows, users, departments] = await Promise.all([
    prisma.assignment.count({ where: { AND: [base, { status: "ACTIVE" }] } }),
    prisma.assignment.count({ where: { AND: [base, { status: "ACTIVE", dueDate: { lt: today } }] } }),
    prisma.assignment.count({ where: { AND: [base, { status: "ACTIVE", dueDate: { gte: today, lte: in7 } }] } }),
    prisma.assignment.findMany({ where: { AND: [base, { status: "DONE", completedAt: { gte: monthStart } }] }, select: { completedAt: true, dueDate: true } }),
    Promise.resolve(0),
    prisma.assignment.count({ where: { AND: [toMe, { status: "ACTIVE" }] } }),
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({
      where,
      include: { document: { include: { status: true } }, assigneeUser: { include: { employee: { include: { department: true } } } }, assigneeDepartment: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    manager ? prisma.user.findMany({ where: { isActive: true }, include: { employee: true }, orderBy: { employee: { lastName: "asc" } } }) : [],
    manager ? prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : [],
  ]);
  void onTimeMonth;
  const onTime = doneMonth.filter((a) => a.dueDate && a.completedAt && a.completedAt <= new Date(a.dueDate.getTime() + 86400000)).length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => makeHref("/assignments", sp, { page: String(p) });
  const tabHref = (t: string) => makeHref("/assignments", {}, { tab: t });
  const without = (...keys: string[]) => makeHref("/assignments", sp, Object.fromEntries([...keys, "page"].map((k) => [k, undefined])));
  const assigneeName = sp.assignee?.startsWith("u:")
    ? (() => { const u = users.find((x) => x.id === sp.assignee!.slice(2)); return u ? shortName(u.employee) : undefined; })()
    : departments.find((d) => d.id === sp.assignee?.slice(2))?.name;
  const DUE_LABELS: Record<string, string> = { overdue: "Хэтэрсэн", week: "7 хоногт дуусах" };
  const chips = [
    ...(sp.q ? [{ label: `Түлхүүр үг: ${sp.q}`, href: without("q") }] : []),
    ...(assigneeName ? [{ label: `Хариуцагч: ${assigneeName}`, href: without("assignee") }] : []),
    ...(sp.status ? [{ label: `Төлөв: ${ASSIGNMENT_LABELS[sp.status] ?? sp.status}`, href: without("status") }] : []),
    ...(sp.due ? [{ label: `Хугацаа: ${DUE_LABELS[sp.due] ?? sp.due}`, href: without("due") }] : []),
  ];

  return (
    <div>
      <PageHeader
        crumbs={[["Хуваарилалт"]]}
        title="Хуваарилалт"
        subtitle="Баримтыг хариуцагчид хугацаатай хуваарилж, шийдвэрлэлтийн явцыг хянана"
        actions={manager && <Link href="/documents?status=REGISTERED" className="btn-primary"><Plus size={16} /> Хуваарилах</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Шийдвэрлэгдээгүй" value={open} hint="Хариуцагч ажиллаж байна" href={tabHref(tab) + "&status=ACTIVE"} />
        <StatCard label="Хугацаа хэтэрсэн" value={overdue} hint="Хариуцагч, хуваарилсан хүнд мэдэгдсэн" tone="danger" href={tabHref(tab) + "&due=overdue"} />
        <StatCard label="7 хоногт дуусах" value={week} hint={`${fmtShort(today)} – ${fmtShort(in7)}`} href={tabHref(tab) + "&due=week"} />
        <StatCard label="Энэ сард шийдвэрлэсэн" value={doneMonth.length} hint={`Хугацаандаа: ${onTime}`} href={tabHref(tab) + "&status=DONE"} />
      </div>

      <Tabs
        active={tab}
        tabs={[
          ...(manager ? [{ key: "all", label: "Бүх хуваарилалт", href: tabHref("all") }, { key: "byme", label: "Миний хуваарилсан", href: tabHref("byme") }] : []),
          { key: "mine", label: `Надад хуваарилагдсан · ${mineCount}`, href: tabHref("mine") },
        ]}
      />

      <form className="card mb-5 space-y-4 p-5" role="search" aria-label="Хуваарилалт шүүх">
        <input type="hidden" name="tab" value={tab} />
        <div className={`grid gap-3 md:grid-cols-2 xl:items-end ${manager ? "xl:grid-cols-[2fr_1.3fr_1fr_1fr_auto]" : "xl:grid-cols-[2fr_1fr_1fr_auto]"}`}>
          <div><label className="label" htmlFor="as-q">Түлхүүр үг</label><input id="as-q" name="q" defaultValue={sp.q} placeholder="Баримтын дугаар, гарчгаар…" className="input" /></div>
          {manager && (
            <div>
              <label className="label" htmlFor="as-who">Хариуцагч</label>
              <select id="as-who" name="assignee" defaultValue={sp.assignee ?? ""} className="input">
                <option value="">Бүх ажилтан, нэгж</option>
                <optgroup label="Ажилтан">{users.map((u) => <option key={u.id} value={`u:${u.id}`}>{shortName(u.employee)}</option>)}</optgroup>
                <optgroup label="Нэгж">{departments.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}</optgroup>
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="as-status">Төлөв</label>
            <select id="as-status" name="status" defaultValue={sp.status ?? ""} className="input">
              <option value="">Бүх төлөв</option>
              {Object.entries(ASSIGNMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="as-due">Хугацаа</label>
            <select id="as-due" name="due" defaultValue={sp.due ?? ""} className="input">
              <option value="">Бүгд</option>
              <option value="overdue">Хэтэрсэн</option>
              <option value="week">7 хоногт дуусах</option>
            </select>
          </div>
          <button className="btn-primary">Шүүх</button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">Идэвхтэй шүүлтүүр:</span>
            {chips.map((c) => <FilterChip key={c.label} label={c.label} href={c.href} />)}
            <Link href={tabHref(tab)} className="text-xs font-semibold text-navy-700 hover:underline">Бүгдийг арилгах</Link>
          </div>
        )}
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60">
              <tr><th className="th">Дугаар</th><th className="th">Гарчиг</th><th className="th">Хариуцагч</th><th className="th">Хуваарилсан</th><th className="th">Хугацаа</th><th className="th">Үлдсэн хугацаа</th><th className="th">Төлөв</th><th className="th">Үйлдэл</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => {
                const active = a.status === "ACTIVE";
                const diff = a.dueDate ? daysBetween(today, a.dueDate) : null;
                const late = active && diff !== null && diff < 0;
                let remain: React.ReactNode = "—";
                if (!active) remain = <span className="text-slate-500">{a.completedAt ? `${fmtShort(a.completedAt)}-нд ${a.status === "DONE" ? "шийдвэрлэсэн" : "шилжүүлсэн"}` : "—"}</span>;
                else if (diff !== null) remain = late ? <span className="font-semibold text-red-700">{-diff} хоног хэтэрсэн</span> : <span className={diff <= 3 ? "font-semibold text-orange-600" : "text-slate-600"}>{diff} хоног үлдсэн</span>;
                return (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap font-semibold">{a.document.documentNumber ?? a.document.internalNumber}</td>
                    <td className="td max-w-72"><Link href={`/documents/${a.documentId}`} className="link">{a.document.title}</Link></td>
                    <td className="td">
                      {a.assigneeUser ? (
                        <><div className="font-medium">{shortName(a.assigneeUser.employee)}</div><div className="text-xs text-slate-500">{a.assigneeUser.employee.department.name}</div></>
                      ) : (
                        <><div className="font-medium">{a.assigneeDepartment?.name} <Pill>Нэгж</Pill></div></>
                      )}
                    </td>
                    <td className="td text-slate-600">{fmtShort(a.assignedAt)}</td>
                    <td className="td text-slate-600">{fmtShort(a.dueDate)}</td>
                    <td className="td">{remain}</td>
                    <td className="td"><Pill tone={a.status === "DONE" ? "green" : active ? "violet" : "slate"}>{ASSIGNMENT_LABELS[a.status]}</Pill></td>
                    <td className="td whitespace-nowrap font-semibold">
                      {late && manager ? (
                        <form action={remind}><input type="hidden" name="assignmentId" value={a.id} /><SubmitButton className="font-semibold link disabled:opacity-60" pendingText="Илгээж байна">Сануулах</SubmitButton></form>
                      ) : (
                        <Link href={`/documents/${a.documentId}`} className="link">Үзэх</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <EmptyRow cols={8} text={chips.length ? "Шүүлтүүрт тохирох хуваарилалт олдсонгүй." : "Хуваарилалт алга."} action={chips.length ? <Link href={tabHref(tab)} className="link text-sm">Шүүлтүүрийг арилгах</Link> : undefined} />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} from={(page - 1) * PAGE_SIZE + 1} to={Math.min(total, page * PAGE_SIZE)} href={href} />
      </div>
      <p className="mt-3 text-xs text-slate-400">Хугацаа хэтэрсэн нь эхэндээ эрэмбэлэгдэнэ</p>
    </div>
  );
}
