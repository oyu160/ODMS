import Link from "next/link";
import { Download, Plus, Clock3, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { documentScope } from "@/lib/access";
import { fmtShort, shortName, startOfToday, daysBetween, TZ } from "@/lib/format";
import { PageHeader, Card, StatCard, StatusBadge, Pill, STATUS_COLOR } from "@/components/ui";
import { Donut, GroupedBars } from "@/components/charts";

export const dynamic = "force-dynamic";

function monthKey(d: Date) {
  return d.toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 7); // 2026-10
}

export default async function DashboardPage() {
  const user = await requireUser();
  const scope = documentScope(user);
  const today = startOfToday();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [total, thisMonth, myReviews, inReview, activeAssign, overdue, byStatus, statuses, registered, resolved, reviewList, overdueList] =
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
      prisma.approval.findMany({
        where: { reviewerId: user.id, decision: "PENDING" },
        include: { document: { include: { documentType: true, createdBy: { include: { employee: true } }, status: true } } },
        orderBy: { document: { updatedAt: "desc" } },
        take: 3,
      }),
      prisma.assignment.findMany({
        where: { status: "ACTIVE", dueDate: { lt: today }, document: scope },
        include: { document: true, assigneeUser: { include: { employee: true } }, assigneeDepartment: true },
        orderBy: { dueDate: "asc" },
        take: 3,
      }),
    ]);

  // «Миний хийх ажил»: одоо энэ хэрэглэгчийн үйлдэл хүлээж буй зүйлс
  const rec = can(user, "document.register");
  const [myActive, myOverdue, myReturned, myDraft, toRegister, toAssign, toArchive] = await Promise.all([
    prisma.assignment.count({ where: { status: "ACTIVE", OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] } }),
    prisma.assignment.count({ where: { status: "ACTIVE", dueDate: { lt: today }, OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] } }),
    prisma.document.count({ where: { createdById: user.id, isDeleted: false, status: { code: "RETURNED" } } }),
    prisma.document.count({ where: { createdById: user.id, isDeleted: false, status: { code: "DRAFT" } } }),
    rec ? prisma.document.count({ where: { isDeleted: false, status: { code: "APPROVED" } } }) : 0,
    rec ? prisma.document.count({ where: { isDeleted: false, status: { code: "REGISTERED" } } }) : 0,
    can(user, "document.archive") ? prisma.document.count({ where: { isDeleted: false, status: { code: "RESOLVED" } } }) : 0,
  ]);
  const todo = [
    { n: myReviews, label: "баримт таны хяналтыг хүлээж байна", action: "Хянах", href: "/reviews", tone: "amber" },
    { n: myActive, label: `баримт танд хуваарилагдсан${myOverdue ? ` (${myOverdue} нь хугацаа хэтэрсэн)` : ""}`, action: "Шийдвэрлэх", href: "/assignments?tab=mine&status=ACTIVE", tone: myOverdue ? "red" : "navy" },
    { n: myReturned, label: "таны баримт засварт буцсан", action: "Засах", href: "/documents?status=RETURNED&mine=1", tone: "amber" },
    { n: myDraft, label: "ноорог хадгалсан, илгээгээгүй", action: "Үргэлжлүүлэх", href: "/documents?status=DRAFT&mine=1", tone: "slate" },
    { n: toRegister, label: "батлагдсан баримт бүртгэл хүлээж байна", action: "Бүртгэх", href: "/documents?status=APPROVED", tone: "navy" },
    { n: toAssign, label: "бүртгэгдсэн баримт хуваарилалт хүлээж байна", action: "Хуваарилах", href: "/documents?status=REGISTERED", tone: "navy" },
    { n: toArchive, label: "шийдвэрлэгдсэн баримт архивлах боломжтой", action: "Архивлах", href: "/documents?status=RESOLVED", tone: "slate" },
  ].filter((t) => t.n > 0);
  const TONE: Record<string, string> = { amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-700", navy: "bg-navy-50 text-navy-800", slate: "bg-slate-100 text-slate-700" };

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

      <Card title="Миний хийх ажил" className="mb-5" right={<span className="text-xs text-slate-500">Таны үйлдэл хүлээж буй зүйлс</span>}>
        {todo.length === 0 ? (
          <p className="text-sm text-slate-500">Танд одоогоор хийх ажил алга. 👍</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {todo.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="group flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 transition hover:border-navy-600 hover:bg-navy-50/30">
                  <span className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base font-bold ${TONE[t.tone]}`}>{t.n}</span>
                  <span className="flex-1 text-sm text-slate-700">{t.label}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-navy-700 group-hover:underline">{t.action} <ArrowRight size={14} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Нийт баримт" value={total} hint={`Энэ сард +${thisMonth} үүссэн`} href="/documents" />
        <StatCard label="Миний хяналт хүлээж буй" value={myReviews} hint={`Нийт хяналтад: ${inReview}`} href={can(user, "document.review") ? "/reviews" : "/documents?status=IN_REVIEW"} />
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
              { name: "Бүртгэгдсэн", color: "#1e3a5f", values: bucket(registered.map((r) => r.registeredAt)) },
              { name: "Шийдвэрлэгдсэн", color: "#9fb3cc", values: bucket(resolved.map((r) => r.completedAt)) },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Миний хяналт хүлээж буй баримт" right={<Link href="/reviews" className="font-medium text-navy-800 hover:underline">Бүгдийг үзэх →</Link>}>
          <ul className="divide-y divide-slate-100">
            {reviewList.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Хянах баримт алга</li>}
            {reviewList.map((a) => (
              <li key={a.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{a.document.internalNumber} · {a.document.title}</div>
                  <div className="text-xs text-slate-500">{a.document.documentType.name} · {shortName(a.document.createdBy.employee)} · Илгээсэн: {fmtShort(a.document.updatedAt ?? a.document.createdAt)}</div>
                </div>
                <StatusBadge code={a.document.status.code} name={a.document.status.name} />
                <Link href={`/reviews?id=${a.documentId}`} className="flex items-center gap-1 text-sm font-semibold text-navy-800">Хянах <ArrowRight size={14} /></Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Хугацаа хэтэрсэн хуваарилалт" right={<Link href="/assignments?due=overdue" className="font-medium text-navy-800 hover:underline">Хуваарилалт үзэх →</Link>}>
          <ul className="divide-y divide-slate-100">
            {overdueList.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Хугацаа хэтэрсэн зүйл алга 🎉</li>}
            {overdueList.map((a) => (
              <li key={a.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/documents/${a.documentId}`} className="block truncate text-sm font-semibold link">
                    {a.document.documentNumber ?? a.document.internalNumber} · {a.document.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    Хариуцагч: {a.assigneeUser ? shortName(a.assigneeUser.employee) : a.assigneeDepartment?.name} · Хугацаа: {fmtShort(a.dueDate)}
                  </div>
                </div>
                <Pill tone="red">{daysBetween(a.dueDate!, today)} хоног хэтэрсэн</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-5 text-xs text-slate-400">Харагдах мэдээлэл таны үүрэг, хэлтсийн эрхээр хязгаарлагдана.</p>
    </div>
  );
}
