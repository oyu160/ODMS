// Баримтын жагсаалтын шүүлтүүр — дэлгэц болон Excel экспорт хоёуланд ашиглана
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { documentScope } from "./access";

export type DocFilter = { q?: string; type?: string; status?: string; direction?: string; from?: string; to?: string; mine?: string; assignee?: string; sort?: SortKey; dir?: "asc" | "desc" };

/** Эрэмбэлэх боломжтой баганууд */
export type SortKey = "number" | "title" | "date";
const SORT_KEYS: SortKey[] = ["number", "title", "date"];

export function readFilter(sp: Record<string, string | string[] | undefined>): DocFilter {
  const g = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const sort = SORT_KEYS.find((k) => k === g("sort"));
  const dir = g("dir") === "asc" ? "asc" : g("dir") === "desc" ? "desc" : undefined;
  return { q: g("q"), type: g("type"), status: g("status"), direction: g("direction"), from: g("from"), to: g("to"), mine: g("mine"), assignee: g("assignee"), sort, dir };
}

export function buildWhere(user: CurrentUser, f: DocFilter): Prisma.DocumentWhereInput {
  const and: Prisma.DocumentWhereInput[] = [documentScope(user)];
  if (f.q) {
    and.push({
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { summary: { contains: f.q, mode: "insensitive" } },
        { documentNumber: { contains: f.q, mode: "insensitive" } },
        { internalNumber: { contains: f.q, mode: "insensitive" } },
        { createdBy: { employee: { firstName: { contains: f.q, mode: "insensitive" } } } },
        { fieldValues: { some: { valueText: { contains: f.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.mine) and.push({ createdById: user.id });
  // Хариуцагчаар шүүх: "me" — надад эсвэл миний нэгжид, "u:<id>" — ажилтан, "d:<id>" — нэгж (идэвхтэй/дууссан хуваарилалт аль аль нь)
  if (f.assignee === "me") and.push({ assignments: { some: { status: { not: "REASSIGNED" }, OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] } } });
  else if (f.assignee?.startsWith("u:")) and.push({ assignments: { some: { status: { not: "REASSIGNED" }, assigneeUserId: f.assignee.slice(2) } } });
  else if (f.assignee?.startsWith("d:")) and.push({ assignments: { some: { status: { not: "REASSIGNED" }, assigneeDepartmentId: f.assignee.slice(2) } } });
  if (f.type) and.push({ documentTypeId: f.type });
  if (f.status) and.push({ status: { code: f.status } });
  if (f.direction) and.push({ direction: f.direction });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+08:00`) } });
  if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59+08:00`) } });
  return { AND: and };
}

/** Эрэмбэ: анхдагчаар огноогоор, шинэ нь эхэндээ. Дугаараар эрэмбэлэхэд дотоод дугаар (бүх баримтад байдаг) */
export function buildOrderBy(f: DocFilter): Prisma.DocumentOrderByWithRelationInput[] {
  const dir = f.dir ?? (f.sort && f.sort !== "date" ? "asc" : "desc");
  if (f.sort === "number") return [{ internalNumber: dir }];
  if (f.sort === "title") return [{ title: dir }, { createdAt: "desc" }];
  return [{ createdAt: dir }];
}
