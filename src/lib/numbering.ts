// Dugaar olgoh (diplomiin 3.3-iin algoritm, BD-07)
// Toologchiig transaction dotor tugjij nemegduuldeg tul zereg batlahad dawhardsan,
// algassan dugaar uusehgui. Transaction amjiltgui bolbol toologch ch butsaagdana.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** (durem, negj, jil)-iin toologchiig 1-eer nemj shine utgiig butsaana */
async function nextValue(tx: Tx, ruleId: string | null, departmentId: string | null, year: number) {
  // Ijil tulhuurtei zeregtsee transaction-uudiig daraaluulna (SELECT … FOR UPDATE-tei ijil ur dun,
  // gehdee toologchiin mur anh uuseh ued ch ajilladag)
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

/** Helber: {TYPE} {DEPT} {YYYY} {YY} {SEQ} {SEQ:4} */
export function formatNumber(pattern: string, v: { typeCode: string; deptCode: string; year: number; seq: number }) {
  return pattern
    .replace(/\{SEQ(?::(\d+))?\}/g, (_m, w?: string) => String(v.seq).padStart(Number(w ?? 0), "0"))
    .replace(/\{YYYY\}/g, String(v.year))
    .replace(/\{YY\}/g, String(v.year).slice(-2))
    .replace(/\{TYPE\}/g, v.typeCode)
    .replace(/\{DEPT\}/g, v.deptCode);
}

/** Sistemiin dotood dugaar: D-0125 (uusgeh muchid olgono) */
export async function issueInternalNumber(tx: Tx) {
  const v = await nextValue(tx, null, null, 0);
  return `Д-${String(v).padStart(4, "0")}`;
}

/** Alban yosnii dugaar — zuwhun batlah/burtgeh ued duudagdana */
export async function issueOfficialNumber(tx: Tx, documentId: string) {
  const doc = await tx.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { documentType: { include: { numberingRule: true } }, ownerDepartment: true },
  });
  if (doc.documentNumber) return doc.documentNumber; // neg barimtad hoyor dahi dugaar olgohgui

  const rule = doc.documentType.numberingRule;
  if (!rule) throw new Error(`«${doc.documentType.name}» төрөлд дугаарлалтын дүрэм тохируулаагүй байна`);

  const year = new Date().getFullYear();
  const period = rule.resetPeriod === "YEARLY" ? year : 0;
  const deptId = rule.perDepartment ? doc.ownerDepartmentId : null;
  const seq = await nextValue(tx, rule.id, deptId, period);

  return formatNumber(rule.pattern, { typeCode: doc.documentType.code, deptCode: doc.ownerDepartment.code, year, seq });
}
