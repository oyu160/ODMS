import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, Plus, Clock3, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { documentScope } from "@/lib/access";
import { fmtShort, shortName, startOfToday, daysBetween, TZ } from "@/lib/format";
import { PageHeader, Card, StatCard, Pill, STATUS_COLOR } from "@/components/ui";
import { Donut, GroupedBars } from "@/components/charts";

export const dynamic = "force-dynamic";

function monthKey(d: Date) {
  return d.toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 7); // 2026-10
}

export default async function DashboardPage() {
  const user = await requireUser();
  // Ajlin urgald oroltsdoggui hereglegch (jish: Admin) tsesend ene huudasgui tul jagsaalt ruu shiljuulne
  const hasWorkRole = can(user, "document.create") || can(user, "document.resolve") || can(user, "document.review");
  if (!hasWorkRole) redirect("/documents");
  const scope = documentScope(user);
  const today = startOfToday();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [total, thisMonth, myReviews, inReview, activeAssign, overdue, byStatus, statuses, registered, resolved, overdueList] =
    await Promise.all([
      prisma.document.count({ where: scope }),
      prisma.document.count({ where: { AND: [scope, { createdAt: { gte: monthStart } }] } }),
      prisma.approval.count({ where: { reviewerId: user.id, decision: "PENDING" } }),
      prisma.document.count({ where: { AND: [scope, { status: { code: "IN_REVIEW" } }] } }),
      prisma.assignment.count({ where: { status: "ACTIVE", document: scope } }),
      prisma.assignment.count({ where: { status: "ACTIVE", dueDate: { lt: today }, document: scope } }),
      prisma.document.groupBy({ by: ["statusId"], where: scope, _count: true }),
      prisma.documentStatus.findMany({ orderBy: { displayOrder: "asc" } }),
      prisma.document.findMany({ where: { AND: [scope, { registeredAt: { gte: sixAgo } }] }, select: { registeredAt: true } }),
      prisma.assignment.findMany({ where: { status: "DONE", completedAt: { gte: sixAgo }, document: scope }, select: { completedAt: true } }),
      prisma.assignment.findMany({
        where: { status: "ACTIVE", dueDate: { lt: today }, document: scope },
        include: { document: true, assigneeUser: { include: { employee: true } }, assigneeDepartment: true },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
    ]);

  // «Minii hiih ajil»: odoo ene hereglegchiin uildel huleej bui zuils
  const rec = can(user, "document.register");
  const [myActive, myOverdue, myReturned, myDraft, toRegister, toAssign, toSend, toArchive, sentToArchive] = await Promise.all([
    prisma.assignment.count({ where: { status: "ACTIVE", OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] } }),
    prisma.assignment.count({ where: { status: "ACTIVE", dueDate: { lt: today }, OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] } }),
    prisma.document.count({ where: { createdById: user.id, isDeleted: false, status: { code: "RETURNED" } } }),
    prisma.document.count({ where: { createdById: user.id, isDeleted: false, status: { code: "DRAFT" } } }),
    rec ? prisma.document.count({ where: { isDeleted: false, status: { code: "APPROVED" } } }) : 0,
    rec ? prisma.document.count({ where: { isDeleted: false, direction: { not: "OUTGOING" }, status: { code: "REGISTERED" } } }) : 0,
    rec ? prisma.document.count({ where: { isDeleted: false, direction: "OUTGOING", status: { code: "REGISTERED" } } }) : 0,
    can(user, "document.archive") ? prisma.document.count({ where: { isDeleted: false, status: { code: "RESOLVED" } } }) : 0,
    can(user, "document.archive") ? prisma.document.count({ where: { isDeleted: false, status: { code: "SENT" } } }) : 0,
  ]);
  // «Minii hiih ajil»: tuluwiin ungutei, hetersen ajil ulaanaar todorno
  const todo = [
    { n: myReviews, title: "Хянах", label: "таны хяналт хүлээж буй баримт", action: "Хянах", href: "/reviews", tone: "review" },
    { n: myOverdue, title: "Хугацаа хэтэрсэн", label: "танд хуваарилагдсан", action: "Шийдвэрлэх", href: "/assignments?tab=mine&due=overdue", tone: "danger" },
    { n: myActive - myOverdue, title: "Шийдвэрлэх", label: "танд хуваарилагдсан баримт", action: "Шийдвэрлэх", href: "/assignments?tab=mine&status=ACTIVE", tone: "assigned" },
    { n: can(user, "document.create") ? myReturned : 0, title: "Засварт буцсан", label: "таны баримт", action: "Засах", href: "/documents?status=RETURNED&mine=1", tone: "returned" },
    { n: can(user, "document.create") ? myDraft : 0, title: "Ноорог", label: "хадгалсан, илгээгээгүй", action: "Үргэлжлүүлэх", href: "/documents?status=DRAFT&mine=1", tone: "draft" },
    { n: toRegister, title: "Бүртгэх", label: "батлагдсан баримт", action: "Бүртгэх", href: "/documents?status=APPROVED", tone: "approved" },
    { n: toAssign, title: "Хуваарилах", label: "бүртгэгдсэн баримт", action: "Хуваарилах", href: "/documents?status=REGISTERED", tone: "registered" },
    { n: toSend, title: "Илгээх", label: "бүртгэгдсэн явсан бичиг", action: "Илгээх", href: "/documents?status=REGISTERED&direction=OUTGOING", tone: "registered" },
    { n: toArchive, title: "Архивлах", label: "шийдвэрлэгдсэн баримт", action: "Архивлах", href: "/documents?status=RESOLVED", tone: "draft" },
    { n: sentToArchive, title: "Архивлах", label: "илгээсэн явсан бичиг", action: "Архивлах", href: "/documents?status=SENT", tone: "draft" },
  ].filter((t) => t.n > 0);
  const todoTotal = todo.reduce((a, t) => a + t.n, 0);
  const TONE: Record<string, { box: string; num: string }> = {
    review: { box: "border-amber-200 bg-amber-50/60", num: "bg-amber-100 text-amber-800" },
    danger: { box: "border-red-200 bg-red-50/70", num: "bg-red-100 text-red-700" },
    assigned: { box: "border-slate-200", num: "bg-violet-100 text-violet-800" },
    returned: { box: "border-slate-200", num: "bg-orange-100 text-orange-800" },
    approved: { box: "border-slate-200", num: "bg-teal-100 text-teal-800" },
    registered: { box: "border-slate-200", num: "bg-blue-100 text-blue-800" },
    draft: { box: "border-slate-200", num: "bg-slate-100 text-slate-700" },
  };

  const countOf = (id: string) => byStatus.find((b) => b.statusId === id)?._count ?? 0;
  const donut = statuses.map((s) => ({ name: s.name, value: countOf(s.id), color: STATUS_COLOR[s.code] ?? "#94a3b8", code: s.code }));

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15))));
  const bucket = (dates: (Date | null)[]) => months.map((m) => dates.filter((d) => d && monthKey(d) === m).length);

  return (
    <div>
      <PageHeader
        crumbs={[["Хяналтын самбар"]]}
        title="Хяналтын самбар"
        subtitle={`Сайн байна уу, ${user.fullName.split(".")[1] ?? user.fullName}. Таны хариуцсан ажлын өнөөдрийн байдал.`}
        actions={
          <>
            {can(user, "report.view") && <Link href="/reports" className="btn-outline"><Download size={16} /> Тайлан татах</Link>}
            {can(user, "document.create") && <Link href="/documents/new" className="btn-primary"><Plus size={16} /> Баримт үүсгэх</Link>}
          </>
        }
      />

      <Card title="Миний хийх ажил" className="mb-5" right={todo.length > 0 && <span className="text-xs text-slate-500">{todoTotal} зүйл таны үйлдлийг хүлээж байна</span>}>
        {todo.length === 0 ? (
          <p className="text-sm text-slate-500">Танд одоогоор хийх ажил алга.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {todo.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition hover:border-navy-600 hover:shadow-sm ${TONE[t.tone].box}`}>
                  <span className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base font-bold ${TONE[t.tone].num}`}>{t.n}</span>
                  <span className="flex-1 text-sm text-slate-600">
                    <b className={t.tone === "danger" ? "text-red-700" : "text-slate-900"}>{t.title}</b> — {t.label}
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-navy-700 group-hover:underline">{t.action} <ArrowRight size={14} aria-hidden /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Нийт баримт" value={total} hint={`Энэ сард +${thisMonth} үүссэн`} href="/documents" />
        <StatCard label="Хяналтад байгаа" value={inReview} hint={can(user, "document.review") ? `Таны хяналтад: ${myReviews}` : "Хянагч шийдвэр гаргаж байна"} href="/documents?status=IN_REVIEW" />
        <StatCard label="Хуваарилагдсан" value={activeAssign} hint="Хариуцагч шийдвэрлэж байна" href="/assignments?status=ACTIVE" />
        <StatCard label="Хугацаа хэтэрсэн" value={overdue} hint="Шийдвэрлэх хугацаа өнгөрсөн хуваарилалт" tone="danger" icon={<Clock3 size={18} />} href="/assignments?due=overdue" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Баримтын төлөв" right={<Link href="/documents" className="font-medium text-navy-800 hover:underline">Жагсаалт үзэх →</Link>}>
          <div className="flex flex-wrap items-center gap-8">
            <Donut data={donut} total={total} label="нийт баримт" />
            <ul className="min-w-56 flex-1 space-y-1.5 text-sm">
              {donut.map((d) => (
                <li key={d.name}>
                  <Link href={`/documents?status=${d.code}`} className="flex items-center gap-2.5 rounded-md hover:bg-slate-50">
                    <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
                    <span className="flex-1 text-slate-700">{d.name}</span>
                    <span className="font-semibold">{d.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Сүүлийн 6 сарын бүртгэл ба шийдвэрлэлт">
          <GroupedBars
            labels={months.map((m) => `${Number(m.slice(5))}-р сар`)}
            series={[
              { name: "Бүртгэгдсэн", color: "#115e59", values: bucket(registered.map((r) => r.registeredAt)) },
              { name: "Шийдвэрлэгдсэн", color: "#a7d7cf", values: bucket(resolved.map((r) => r.completedAt)) },
            ]}
          />
        </Card>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Хугацаа хэтэрсэн хуваарилалт</h2>
          <Link href="/assignments?due=overdue" className="flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">Бүгдийг харах <ArrowRight size={14} aria-hidden /></Link>
        </div>
        {overdueList.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-8 text-center text-sm text-slate-500">Хугацаа хэтэрсэн хуваарилалт алга.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-slate-200 bg-slate-50/60">
                <tr><th className="th">Дугаар</th><th className="th">Гарчиг</th><th className="th">Хариуцагч</th><th className="th">Хугацаа</th><th className="th">Хэтэрсэн</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueList.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap font-semibold">{a.document.documentNumber ?? a.document.internalNumber}</td>
                    <td className="td"><Link href={`/documents/${a.documentId}`} className="link">{a.document.title}</Link></td>
                    <td className="td text-slate-600">{a.assigneeUser ? shortName(a.assigneeUser.employee) : `${a.assigneeDepartment?.name} (нэгж)`}</td>
                    <td className="td whitespace-nowrap text-slate-600">{fmtShort(a.dueDate)}</td>
                    <td className="td"><Pill tone="red">{daysBetween(a.dueDate!, today)} хоног</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-5 text-xs text-slate-500">Харагдах мэдээлэл таны үүрэг, хэлтсийн эрхээр хязгаарлагдана.</p>
    </div>
  );
}
