// Дугаар олгох (дипломын 3.3-ын алгоритм, БД-07)
// Тоологчийг транзакц дотор түгжиж нэмэгдүүлдэг тул зэрэг батлахад давхардсан,
// алгассан дугаар үүсэхгүй. Транзакц амжилтгүй болбол тоологч ч буцаагдана.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** (дүрэм, нэгж, жил)-ийн тоологчийг 1-ээр нэмж шинэ утгыг буцаана */
async function nextValue(tx: Tx, ruleId: string | null, departmentId: string | null, year: number) {
  // Ижил түлхүүртэй зэрэгцээ транзакцуудыг дараалуулна (SELECT … FOR UPDATE-тэй ижил үр дүн,
  // гэхдээ тоологчийн мөр анх үүсэх үед ч ажилладаг)
  const key = `${ruleId ?? "internal"}:${departmentId ?? "-"}:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

  const seq = await tx.numberSequence.findFirst({
    where: { numberingRuleId: ruleId, departmentId, periodYear: year },
  });
  if (seq) {
    const updated = await tx.numberSequence.update({
      where: { id: seq.id },
      data: { currentValue: { increment: 1 } },
    });
    return updated.currentValue;
  }
  await tx.numberSequence.create({
    data: { numberingRuleId: ruleId, departmentId, periodYear: year, currentValue: 1 },
  });
  return 1;
}

/** Хэлбэр: {TYPE} {DEPT} {YYYY} {YY} {SEQ} {SEQ:4} */
export function formatNumber(pattern: string, v: { typeCode: string; deptCode: string; year: number; seq: number }) {
  return pattern
    .replace(/\{SEQ(?::(\d+))?\}/g, (_m, w?: string) => String(v.seq).padStart(Number(w ?? 0), "0"))
    .replace(/\{YYYY\}/g, String(v.year))
    .replace(/\{YY\}/g, String(v.year).slice(-2))
    .replace(/\{TYPE\}/g, v.typeCode)
    .replace(/\{DEPT\}/g, v.deptCode);
}

/** Системийн дотоод дугаар: Д-0125 (үүсгэх мөчид олгоно) */
export async function issueInternalNumber(tx: Tx) {
  const v = await nextValue(tx, null, null, 0);
  return `Д-${String(v).padStart(4, "0")}`;
}

/** Албан ёсны дугаар — зөвхөн батлах/бүртгэх үед дуудагдана */
export async function issueOfficialNumber(tx: Tx, documentId: string) {
  const doc = await tx.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { documentType: { include: { numberingRule: true } }, ownerDepartment: true },
  });
  if (doc.documentNumber) return doc.documentNumber; // нэг баримтад хоёр дахь дугаар олгохгүй

  const rule = doc.documentType.numberingRule;
  if (!rule) throw new Error(`«${doc.documentType.name}» төрөлд дугаарлалтын дүрэм тохируулаагүй байна`);

  const year = new Date().getFullYear();
  const period = rule.resetPeriod === "YEARLY" ? year : 0;
  const deptId = rule.perDepartment ? doc.ownerDepartmentId : null;
  const seq = await nextValue(tx, rule.id, deptId, period);

  return formatNumber(rule.pattern, { typeCode: doc.documentType.code, deptCode: doc.ownerDepartment.code, year, seq });
}
