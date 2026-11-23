"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { documentScope } from "@/lib/access";
import { RELATION_TYPES } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { performAction, remindAssignment, WorkflowError } from "@/lib/workflow";

export type ActionState = { error?: string; ok?: string } | undefined;

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export async function runAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const action = String(formData.get("action"));
  const assignee = s(formData, "assignee"); // "u:<id>" eswel "d:<id>"
  try {
    const doc = await performAction(user, documentId, action, {
      comment: s(formData, "comment"),
      reviewerId: s(formData, "reviewerId"),
      assigneeUserId: assignee?.startsWith("u:") ? assignee.slice(2) : undefined,
      assigneeDepartmentId: assignee?.startsWith("d:") ? assignee.slice(2) : undefined,
      dueDate: s(formData, "dueDate"),
      archiveCategory: s(formData, "archiveCategory"),
      storageLocation: s(formData, "storageLocation"),
      disposalAction: s(formData, "disposalAction"),
      sentAt: s(formData, "sentAt"),
      sendMethod: s(formData, "sendMethod"),
      recipient: s(formData, "recipient"),
      receiptRef: s(formData, "receiptRef"),
      password: typeof formData.get("password") === "string" ? String(formData.get("password")) : undefined,
    });
    revalidatePath("/", "layout");
    const msg =
      action === "approve"
        ? `Баталж, цахим гарын үсгээр баталгаажууллаа. Албан ёсны дугаар: ${doc.documentNumber}`
        : action === "register_incoming"
          ? `Амжилттай. Албан ёсны дугаар: ${doc.documentNumber}`
          : action === "send"
            ? "Илгээлтийг бүртгэлээ. Одоо архивлах боломжтой"
            : "Амжилттай хадгалагдлаа";
    return { ok: msg };
  } catch (e) {
    if (e instanceof WorkflowError) return { error: e.message };
    console.error(e);
    return { error: "Алдаа гарлаа. Дахин оролдоно уу" };
  }
}

export async function remind(formData: FormData) {
  const user = await requireUser();
  try {
    await remindAssignment(user, String(formData.get("assignmentId")));
  } catch (e) {
    if (!(e instanceof WorkflowError)) throw e;
  }
  revalidatePath("/assignments");
}

/**
 * Hyanagch jijig zaswar oruulah: barimtiig uusgegch ruu butsaalguigeer garchig, aguulga,
 * talbariin utgiig zasaj shine huwilbar uusgene. Songoson bol zaswariin daraa shuud batalna.
 * Zuwhun tuhain barimtiin hyanalt huleej bui hyanagch hiine; zaswar bur huwilbar, auditad uldene.
 */
export async function reviewerEdit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const note = s(formData, "editNote");
  const title = s(formData, "title");
  if (!note) return { error: "Юу зассанаа тайлбарлана уу" };
  if (!title || title.length < 3) return { error: "Гарчиг дор хаяж 3 тэмдэгт байна" };
  if (formData.get("approveAfter") === "on" && !formData.get("password")) return { error: "Шууд батлахын тулд цахим гарын үсгийн нууц үгээ оруулна уу" };

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { status: true, fieldValues: true, documentType: { include: { fields: { where: { isActive: true } } } } },
  });
  if (!doc || doc.status.code !== "IN_REVIEW") return { error: "Зөвхөн хяналтад байгаа баримтыг засна" };
  const pending = await prisma.approval.findFirst({ where: { documentId, reviewerId: user.id, decision: "PENDING" } });
  if (!pending) return { error: "Энэ баримт танд хяналтаар ирээгүй байна" };

  const values: { fieldId: string; valueText: string }[] = [];
  for (const f of doc.documentType.fields) {
    const key = `f_${f.id}`;
    const raw = formData.has(key) ? String(formData.get(key) ?? "").trim() : doc.fieldValues.find((v) => v.fieldId === f.id)?.valueText ?? "";
    if (!raw) {
      if (f.isRequired) return { error: `«${f.label}» талбар хоосон байж болохгүй` };
      continue;
    }
    values.push({ fieldId: f.id, valueText: raw });
  }
  const summary = s(formData, "summary") ?? null;

  // Yuu uurchlugdsuniig auditad hadgalna
  const changed: string[] = [];
  if (title !== doc.title) changed.push("гарчиг");
  if ((summary ?? "") !== (doc.summary ?? "")) changed.push("агуулга");
  for (const f of doc.documentType.fields) {
    const before = doc.fieldValues.find((v) => v.fieldId === f.id)?.valueText ?? "";
    const after = values.find((v) => v.fieldId === f.id)?.valueText ?? "";
    if (before !== after) changed.push(f.label.toLowerCase());
  }
  if (changed.length === 0) return { error: "Өөрчлөлт хийгдээгүй байна" };

  const versionNo = doc.currentVersionNo + 1;
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: documentId }, data: { title, summary, currentVersionNo: versionNo } });
    await tx.documentFieldValue.deleteMany({ where: { documentId } });
    if (values.length) await tx.documentFieldValue.createMany({ data: values.map((v) => ({ ...v, documentId })) });
    await tx.documentVersion.create({
      data: { documentId, versionNo, changeNote: `Хянагч зассан: ${note}`, createdById: user.id, snapshot: { title, summary, fields: values } },
    });
    await writeAudit(
      { userId: user.id, documentId, entityType: "document", entityId: documentId, action: "REVIEWER_EDIT", newValue: { comment: note, changed: changed.join(", "), version: versionNo } },
      tx,
    );
    await tx.notification.create({
      data: { userId: doc.createdById, documentId, type: "REVIEWER_EDIT", message: `Хянагч «${title}» баримтад засвар оруулсан: ${note}` },
    });
  });

  if (formData.get("approveAfter") === "on") {
    try {
      const approved = await performAction(user, documentId, "approve", {
        comment: `Засвар оруулж баталсан: ${note}`,
        password: typeof formData.get("password") === "string" ? String(formData.get("password")) : undefined,
      });
      revalidatePath("/", "layout");
      return { ok: `Засаад баталлаа. Албан ёсны дугаар: ${approved.documentNumber}` };
    } catch (e) {
      revalidatePath("/", "layout");
      if (e instanceof WorkflowError) return { error: `Засвар хадгалагдсан боловч батлах үед: ${e.message}` };
      throw e;
    }
  }
  revalidatePath("/", "layout");
  return { ok: `Засвар хадгалагдлаа (хувилбар ${versionNo}): ${changed.join(", ")}` };
}

/**
 * FSh-22: barimt hoorond hamaaral uusgeh (Undeslesen, Hariu, Uurchilsun, Huchingui bolgoson).
 * Barimt bichgiin ajiltan eswel barimtiin uusgegch nemne. Hoyor barimt hoyoulaa hereglegchiin harah hureend baih yostoi.
 * Batlagdsan barimtiig uurchluh bol shine barimt uusgej «Uurchilsun» hamaarlaar holbono (BD-12).
 */
export async function addRelation(formData: FormData) {
  const user = await requireUser();
  const sourceId = String(formData.get("documentId"));
  const targetId = s(formData, "targetId");
  const type = s(formData, "relationType");
  const back = (msg: string): never => redirect(`/documents/${sourceId}?msg=${encodeURIComponent(msg)}`);
  if (!targetId || !type || !RELATION_TYPES.includes(type)) back("Холбох баримт болон хамаарлын төрлийг сонгоно уу");
  if (targetId === sourceId) back("Баримтыг өөртэй нь холбох боломжгүй");

  const docs = await prisma.document.findMany({ where: { AND: [{ id: { in: [sourceId, targetId!] } }, documentScope(user)] }, select: { id: true, createdById: true, documentNumber: true, internalNumber: true } });
  const source = docs.find((d) => d.id === sourceId);
  if (!source || docs.length < 2) back("Баримт олдсонгүй эсвэл харах эрхгүй байна");
  if (!can(user, "document.register") && source!.createdById !== user.id) back("Хамаарал үүсгэх эрхгүй байна");

  const exists = await prisma.documentRelation.findFirst({ where: { sourceDocumentId: sourceId, targetDocumentId: targetId, relationType: type } });
  if (exists) back("Энэ хамаарал аль хэдийн бүртгэгдсэн байна");
  await prisma.$transaction(async (tx) => {
    const r = await tx.documentRelation.create({ data: { sourceDocumentId: sourceId, targetDocumentId: targetId!, relationType: type!, createdById: user.id } });
    await writeAudit({ userId: user.id, documentId: sourceId, entityType: "document_relation", entityId: r.id, action: "RELATE", newValue: { relationType: type!, target: (() => { const t = docs.find((d) => d.id === targetId)!; return t.documentNumber ?? t.internalNumber; })() } }, tx);
  });
  revalidatePath(`/documents/${sourceId}`);
  revalidatePath(`/documents/${targetId}`);
}

/** Buruu uusgesen hamaarliig hasah (uusgegch eswel barimt bichgiin ajiltan). Auditad uldene. */
export async function removeRelation(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("relationId"));
  const documentId = String(formData.get("documentId"));
  const r = await prisma.documentRelation.findUnique({ where: { id }, include: { source: { select: { createdById: true } }, target: { select: { documentNumber: true, internalNumber: true } } } });
  if (!r) redirect(`/documents/${documentId}`);
  if (!can(user, "document.register") && r!.source.createdById !== user.id) redirect(`/documents/${documentId}?msg=${encodeURIComponent("Хамаарал хасах эрхгүй байна")}`);
  await prisma.$transaction(async (tx) => {
    await tx.documentRelation.delete({ where: { id } });
    await writeAudit({ userId: user.id, documentId: r!.sourceDocumentId, entityType: "document_relation", entityId: id, action: "UNRELATE", newValue: { removed: r!.relationType, target: r!.target.documentNumber ?? r!.target.internalNumber } }, tx);
  });
  revalidatePath(`/documents/${r!.sourceDocumentId}`);
  revalidatePath(`/documents/${r!.targetDocumentId}`);
}
