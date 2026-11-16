// Мета өгөгдлөөр автоматаар чиглүүлэх: баримтын төрөл, нууцлал, чиглэл, нэгж, талбарын утгаас
// хамаарч хянагчийг routing_rules хүснэгтийн дүрмээр сонгоно. Дүрмийг код өөрчлөхгүйгээр тохиргооноос нэмнэ.
import type { Prisma } from "@prisma/client";

export type RuleLike = {
  id: string;
  name: string;
  documentTypeId: string | null;
  confidentiality: string | null;
  direction: string | null;
  departmentId: string | null;
  fieldId: string | null;
  fieldValue: string | null;
  reviewerId: string;
  priority: number;
};

export type DocMeta = {
  documentTypeId: string;
  confidentiality: string;
  direction: string;
  ownerDepartmentId: string;
  createdById: string;
  fields: { fieldId: string; valueText: string }[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** Нэг дүрэм баримтад тохирох эсэх (хоосон нөхцөл = ямар ч) — клиент болон сервер хоёуланд ашиглана */
export function ruleMatches(rule: RuleLike, doc: DocMeta) {
  if (rule.documentTypeId && rule.documentTypeId !== doc.documentTypeId) return false;
  if (rule.confidentiality && rule.confidentiality !== doc.confidentiality) return false;
  if (rule.direction && rule.direction !== doc.direction) return false;
  if (rule.departmentId && rule.departmentId !== doc.ownerDepartmentId) return false;
  if (rule.fieldId) {
    const v = doc.fields.find((f) => f.fieldId === rule.fieldId)?.valueText;
    if (!v) return false;
    if (rule.fieldValue && norm(v) !== norm(rule.fieldValue)) return false;
  }
  // БД-05: үүсгэгч өөрөө хянагч болохгүй — дараагийн дүрэм рүү шилжинэ
  if (rule.reviewerId === doc.createdById) return false;
  return true;
}

/** Тохирох эхний дүрэм (priority бага нь түрүүлнэ, тэнцүү бол илүү олон нөхцөлтэй нь) */
export function pickRule<R extends RuleLike>(rules: R[], doc: DocMeta): R | null {
  const specificity = (r: RuleLike) => [r.documentTypeId, r.confidentiality, r.direction, r.departmentId, r.fieldId].filter(Boolean).length;
  const sorted = [...rules].sort((a, b) => a.priority - b.priority || specificity(b) - specificity(a));
  return sorted.find((r) => ruleMatches(r, doc)) ?? null;
}

/** Сервер тал: идэвхтэй дүрмүүдээс тохирохыг олж, хянагч батлах эрхтэй, идэвхтэй эсэхийг шалгана */
export async function resolveRoute(db: { routingRule: Pick<Prisma.TransactionClient["routingRule"], "findMany"> }, doc: DocMeta) {
  const rules = await db.routingRule.findMany({
    where: {
      isActive: true,
      reviewer: {
        isActive: true,
        employee: { employmentStatus: "ACTIVE" },
        roles: { some: { role: { isActive: true, permissions: { some: { permission: { code: "document.approve" } } } } } },
      },
    },
  });
  return pickRule(rules, doc);
}
