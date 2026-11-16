// Баримтын жагсаалтын шүүлтүүр — дэлгэц болон Excel экспорт хоёуланд ашиглана
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { documentScope } from "./access";

export type DocFilter = { q?: string; type?: string; status?: string; direction?: string; from?: string; to?: string; mine?: string };

export function readFilter(sp: Record<string, string | string[] | undefined>): DocFilter {
  const g = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  return { q: g("q"), type: g("type"), status: g("status"), direction: g("direction"), from: g("from"), to: g("to"), mine: g("mine") };
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
  if (f.type) and.push({ documentTypeId: f.type });
  if (f.status) and.push({ status: { code: f.status } });
  if (f.direction) and.push({ direction: f.direction });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+08:00`) } });
  if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59+08:00`) } });
  return { AND: and };
}
