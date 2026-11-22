// Tailangiin hudulguur (diplomiin Husnegt 3.30)
// Tailan bur baganiin ner, muruud, niit dung butsaana — delgets, Excel, hewleh huwilbar bugd uuniig ashiglana.
import "server-only";
import { prisma } from "./prisma";
import { can, type CurrentUser } from "./auth";
import { documentScope } from "./access";
import { fmtDate, shortName, startOfToday, daysBetween, TZ } from "./format";

export type ReportParams = { from?: string; to?: string; department?: string };
export type ReportResult = { columns: string[]; rows: (string | number)[][]; footer?: (string | number)[]; note?: string };
type ReportDef = {
  key: string;
  title: string;
  description: string;
  audience: string;
  permission: string;
  run: (user: CurrentUser, p: ReportParams) => Promise<ReportResult>;
};

function range(p: ReportParams) {
  // Ognoo songoogui bol ene onii ehnees unuudriig hurtel
  const from = p.from ? new Date(`${p.from}T00:00:00+08:00`) : new Date(`${new Date().getFullYear()}-01-01T00:00:00+08:00`);
  const to = p.to ? new Date(`${p.to}T23:59:59+08:00`) : new Date();
  return { from, to };
}
const name = (e?: { lastName: string; firstName: string } | null) => (e ? shortName(e) : "—");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export const REPORTS: ReportDef[] = [
  {
    key: "registration",
    title: "Баримтын бүртгэлийн тайлан",
    description: "Төрөл тус бүрээр үүссэн баримтын тоо; ирсэн, явсан, дотоод баримтын харьцаа",
    audience: "Баримт бичгийн ажилтан, удирдлага",
    permission: "report.view",
    async run(user, p) {
      const { from, to } = range(p);
      const docs = await prisma.document.findMany({
        where: { AND: [documentScope(user), { createdAt: { gte: from, lte: to } }, p.department ? { ownerDepartmentId: p.department } : {}] },
        select: { direction: true, documentType: { select: { name: true } } },
      });
      const map = new Map<string, Record<string, number>>();
      for (const d of docs) {
        const r = map.get(d.documentType.name) ?? { INCOMING: 0, OUTGOING: 0, INTERNAL: 0 };
        r[d.direction] = (r[d.direction] ?? 0) + 1;
        map.set(d.documentType.name, r);
      }
      const rows = [...map.entries()].sort().map(([t, r], i) => [i + 1, t, r.INCOMING, r.OUTGOING, r.INTERNAL, r.INCOMING + r.OUTGOING + r.INTERNAL]);
      const sum = (k: number) => rows.reduce((s, r) => s + Number(r[k]), 0);
      return { columns: ["№", "Баримтын төрөл", "Ирсэн", "Явсан", "Дотоод", "Нийт"], rows, footer: ["", "Нийт", sum(2), sum(3), sum(4), sum(5)] };
    },
  },
  {
    key: "incoming",
    title: "Ирсэн бичгийн бүртгэл",
    description: "Ирсэн огноо, дугаар, илгээгч байгууллага, гарчиг, хариуцагч, шийдвэрлэсэн байдал",
    audience: "Баримт бичгийн ажилтан",
    permission: "document.register",
    async run(user, p) {
      const { from, to } = range(p);
      const docs = await prisma.document.findMany({
        where: { AND: [documentScope(user), { direction: "INCOMING", registeredAt: { gte: from, lte: to } }] },
        include: {
          status: true,
          fieldValues: { include: { field: true } },
          assignments: { orderBy: { assignedAt: "desc" }, take: 1, include: { assigneeUser: { include: { employee: true } }, assigneeDepartment: true } },
        },
        orderBy: { registeredAt: "asc" },
      });
      const rows = docs.map((d, i) => {
        const a = d.assignments[0];
        const sender = d.fieldValues.find((v) => v.field.name === "sender_org")?.valueText ?? "—";
        return [i + 1, fmtDate(d.registeredAt), d.documentNumber ?? d.internalNumber, sender, d.title, a ? (a.assigneeUser ? name(a.assigneeUser.employee) : a.assigneeDepartment?.name ?? "—") : "—", d.status.name];
      });
      return { columns: ["№", "Ирсэн огноо", "Бүртгэлийн дугаар", "Илгээгч байгууллага", "Гарчиг", "Хариуцагч", "Шийдвэрлэсэн байдал"], rows, footer: ["", `Нийт: ${rows.length}`, "", "", "", "", ""] };
    },
  },
  {
    key: "outgoing",
    title: "Явсан бичгийн бүртгэл",
    description: "Явуулсан огноо, дугаар, хүлээн авагч, гарчиг, гарын үсэг зурсан албан тушаалтан",
    audience: "Баримт бичгийн ажилтан",
    permission: "document.register",
    async run(user, p) {
      const { from, to } = range(p);
      const docs = await prisma.document.findMany({
        where: { AND: [documentScope(user), { direction: "OUTGOING", documentNumber: { not: null }, approvedAt: { gte: from, lte: to } }] },
        include: { fieldValues: { include: { field: true } }, approvals: { where: { decision: "APPROVED" }, include: { reviewer: { include: { employee: true } } } } },
        orderBy: { approvedAt: "asc" },
      });
      const rows = docs.map((d, i) => [
        i + 1,
        fmtDate(d.registeredAt ?? d.approvedAt),
        d.documentNumber ?? "",
        d.fieldValues.find((v) => v.field.name === "recipient_org")?.valueText ?? "—",
        d.title,
        name(d.approvals[0]?.reviewer.employee),
      ]);
      return { columns: ["№", "Явуулсан огноо", "Дугаар", "Хүлээн авагч", "Гарчиг", "Гарын үсэг зурсан"], rows, footer: ["", `Нийт: ${rows.length}`, "", "", "", ""] };
    },
  },
  {
    key: "status",
    title: "Төлөвийн тайлан",
    description: "Төлөв тус бүрт байгаа баримтын тоо, эзлэх хувь",
    audience: "Удирдлага",
    permission: "report.view",
    async run(user, p) {
      const { from, to } = range(p);
      const [statuses, groups] = await Promise.all([
        prisma.documentStatus.findMany({ orderBy: { displayOrder: "asc" } }),
        prisma.document.groupBy({ by: ["statusId"], where: { AND: [documentScope(user), { createdAt: { gte: from, lte: to } }] }, _count: true }),
      ]);
      const total = groups.reduce((s, g) => s + g._count, 0);
      const rows = statuses.map((s, i) => {
        const c = groups.find((g) => g.statusId === s.id)?._count ?? 0;
        return [i + 1, s.name, c, pct(c, total)];
      });
      return { columns: ["№", "Төлөв", "Баримтын тоо", "Эзлэх хувь"], rows, footer: ["", "Нийт", total, "100%"] };
    },
  },
  {
    key: "overdue",
    title: "Хугацаа хэтэрсэн баримтын тайлан",
    description: "Хугацаа хэтэрсэн хуваарилалт, хариуцагч, хэтэрсэн хоног",
    audience: "Удирдлага, баримт бичгийн ажилтан",
    permission: "report.view",
    async run(user, p) {
      const today = startOfToday();
      const list = await prisma.assignment.findMany({
        where: { status: "ACTIVE", dueDate: { lt: today }, document: documentScope(user), ...(p.department ? { OR: [{ assigneeDepartmentId: p.department }, { assigneeUser: { employee: { departmentId: p.department } } }] } : {}) },
        include: { document: true, assigneeUser: { include: { employee: { include: { department: true } } } }, assigneeDepartment: true },
        orderBy: { dueDate: "asc" },
      });
      const rows = list.map((a, i) => [
        i + 1,
        a.document.documentNumber ?? a.document.internalNumber,
        a.document.title,
        a.assigneeUser ? name(a.assigneeUser.employee) : `${a.assigneeDepartment?.name} (нэгж)`,
        a.assigneeUser ? a.assigneeUser.employee.department.name : a.assigneeDepartment?.name ?? "",
        fmtDate(a.assignedAt),
        fmtDate(a.dueDate),
        daysBetween(a.dueDate!, today),
      ]);
      const avg = rows.length ? (rows.reduce((s, r) => s + Number(r[7]), 0) / rows.length).toFixed(1) : "0";
      return { columns: ["№", "Баримтын дугаар", "Гарчиг", "Хариуцагч", "Нэгж", "Хуваарилсан", "Эцсийн хугацаа", "Хэтэрсэн хоног"], rows, footer: [`Нийт: ${rows.length} баримт`, "", "", "", "", "", "", `Дундаж: ${avg}`] };
    },
  },
  {
    key: "resolution",
    title: "Шийдвэрлэлтийн тайлан",
    description: "Нэгж, хариуцагчаар шийдвэрлэсэн тоо, дундаж шийдвэрлэх хугацаа, хугацаандаа шийдвэрлэсэн хувь",
    audience: "Удирдлага",
    permission: "report.view",
    async run(user, p) {
      const { from, to } = range(p);
      const list = await prisma.assignment.findMany({
        where: { status: "DONE", completedAt: { gte: from, lte: to }, document: documentScope(user) },
        include: { assigneeUser: { include: { employee: { include: { department: true } } } }, assigneeDepartment: true },
      });
      const map = new Map<string, { unit: string; n: number; days: number; onTime: number }>();
      for (const a of list) {
        const who = a.assigneeUser ? name(a.assigneeUser.employee) : `${a.assigneeDepartment?.name} (нэгж)`;
        const unit = a.assigneeUser ? a.assigneeUser.employee.department.name : a.assigneeDepartment?.name ?? "";
        const r = map.get(who) ?? { unit, n: 0, days: 0, onTime: 0 };
        r.n++;
        r.days += Math.max(0, daysBetween(a.assignedAt, a.completedAt!));
        if (a.dueDate && a.completedAt! <= new Date(a.dueDate.getTime() + 86400000)) r.onTime++;
        map.set(who, r);
      }
      const rows = [...map.entries()].sort((a, b) => a[1].unit.localeCompare(b[1].unit)).map(([who, r], i) => [i + 1, r.unit, who, r.n, (r.days / r.n).toFixed(1), pct(r.onTime, r.n)]);
      const n = list.length;
      const onTime = [...map.values()].reduce((s, r) => s + r.onTime, 0);
      const days = [...map.values()].reduce((s, r) => s + r.days, 0);
      return { columns: ["№", "Нэгж", "Хариуцагч", "Шийдвэрлэсэн", "Дундаж хугацаа (хоног)", "Хугацаандаа"], rows, footer: ["", "Нийт", "", n, n ? (days / n).toFixed(1) : "—", pct(onTime, n)] };
    },
  },
  {
    key: "review",
    title: "Хяналтын тайлан",
    description: "Хянагчаар баталсан, засварт буцаасан тоо, буцаасан хувь",
    audience: "Удирдлага",
    permission: "report.view",
    async run(user, p) {
      const { from, to } = range(p);
      const list = await prisma.approval.findMany({
        where: { decidedAt: { gte: from, lte: to }, decision: { in: ["APPROVED", "RETURNED"] }, document: documentScope(user) },
        include: { reviewer: { include: { employee: true } } },
      });
      const map = new Map<string, { a: number; r: number }>();
      for (const x of list) {
        const k = name(x.reviewer.employee);
        const v = map.get(k) ?? { a: 0, r: 0 };
        if (x.decision === "APPROVED") v.a++;
        else v.r++;
        map.set(k, v);
      }
      const rows = [...map.entries()].map(([k, v], i) => [i + 1, k, v.a, v.r, v.a + v.r, pct(v.r, v.a + v.r)]);
      const A = rows.reduce((s, r) => s + Number(r[2]), 0), R = rows.reduce((s, r) => s + Number(r[3]), 0);
      return { columns: ["№", "Хянагч", "Баталсан", "Засварт буцаасан", "Нийт", "Буцаасан хувь"], rows, footer: ["", "Нийт", A, R, A + R, pct(R, A + R)] };
    },
  },
  {
    key: "archive",
    title: "Архивын тайлан",
    description: "Архивлагдсан баримт, хадгалах хугацаа; ойрын 30 хоногт дуусах болон дууссан баримт",
    audience: "Баримт бичгийн ажилтан",
    permission: "document.archive",
    async run(_user, p) {
      const today = startOfToday();
      const in30 = new Date(today.getTime() + 30 * 86400000);
      const list = await prisma.archive.findMany({
        where: p.from || p.to ? { archivedAt: { gte: range(p).from, lte: range(p).to } } : {},
        include: { document: true },
        orderBy: { retentionUntil: "asc" },
      });
      const rows = list.map((a, i) => {
        const state = !a.retentionUntil ? "—" : a.retentionUntil < today ? "Дууссан" : a.retentionUntil <= in30 ? "30 хоногт дуусна" : "Хадгалагдаж буй";
        return [i + 1, a.document.documentNumber ?? a.document.internalNumber, a.document.title, a.archiveCategory ?? "", fmtDate(a.archivedAt), fmtDate(a.retentionUntil), state];
      });
      const exp = rows.filter((r) => r[6] === "Дууссан").length;
      return { columns: ["№", "Дугаар", "Гарчиг", "Ангилал", "Архивласан", "Хадгалах хугацаа", "Байдал"], rows, footer: [`Нийт: ${rows.length}`, "", "", "", "", `Дууссан: ${exp}`, ""] };
    },
  },
  {
    key: "audit",
    title: "Үйлдлийн бүртгэлийн тайлан",
    description: "Хэрэглэгч бүрийн системд хийсэн үйлдэл: нэвтрэлт, үүсгэх, батлах, хуваарилах г.м.",
    audience: "Администратор",
    permission: "audit.view",
    async run(_user, p) {
      const { from, to } = range(p);
      const logs = await prisma.auditLog.groupBy({ by: ["userId", "action"], where: { createdAt: { gte: from, lte: to } }, _count: true });
      const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.userId))] } }, include: { employee: true } });
      const actions = [...new Set(logs.map((l) => l.action))].sort();
      const rows = users.map((u, i) => {
        const counts = actions.map((a) => logs.find((l) => l.userId === u.id && l.action === a)?._count ?? 0);
        return [i + 1, `${name(u.employee)} (${u.username})`, ...counts, counts.reduce((s, c) => s + c, 0)];
      });
      return { columns: ["№", "Хэрэглэгч", ...actions, "Нийт"], rows };
    },
  },
];

export function findReport(key: string | undefined) {
  return REPORTS.find((r) => r.key === key);
}
export function visibleReports(user: CurrentUser) {
  return REPORTS.filter((r) => can(user, r.permission));
}
export function periodLabel(p: ReportParams) {
  const { from, to } = range(p);
  const f = (d: Date) => d.toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 10).replace(/-/g, ".");
  return `${f(from)} – ${f(to)}`;
}
