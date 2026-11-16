"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { issueInternalNumber } from "@/lib/numbering";
import { saveFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { performAction, WorkflowError } from "@/lib/workflow";

export type SaveState = { error?: string } | undefined;

const Schema = z.object({
  documentId: z.string().optional(),
  documentTypeId: z.string().min(1, "Баримтын төрлийг сонгоно уу"),
  title: z.string().trim().min(3, "Гарчиг дор хаяж 3 тэмдэгт байна").max(255),
  summary: z.string().trim().optional(),
  direction: z.enum(["INCOMING", "OUTGOING", "INTERNAL"]),
  confidentiality: z.enum(["NORMAL", "INTERNAL", "CONFIDENTIAL"]),
  documentDate: z.string().optional(),
  relatedId: z.string().optional(),
  reviewerId: z.string().optional(),
  intent: z.enum(["draft", "submit", "register"]),
});

export async function saveDocument(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requirePermission("document.create");
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v : undefined;
  };
  const parsed = Schema.safeParse({
    documentId: str("documentId"),
    documentTypeId: str("documentTypeId"),
    title: str("title") ?? "",
    summary: str("summary"),
    direction: str("direction"),
    confidentiality: str("confidentiality"),
    documentDate: str("documentDate"),
    relatedId: str("relatedId"),
    reviewerId: str("reviewerId"),
    intent: str("intent") ?? "draft",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const type = await prisma.documentType.findUnique({ where: { id: v.documentTypeId }, include: { fields: { where: { isActive: true } } } });
  if (!type || !type.isActive) return { error: "Баримтын төрөл олдсонгүй" };

  // Төрлөөс хамаарах талбар
  const values: { fieldId: string; valueText: string }[] = [];
  for (const f of type.fields) {
    const raw = String(formData.get(`f_${f.id}`) ?? "").trim();
    if (!raw) {
      if (f.isRequired && v.intent !== "draft") return { error: `«${f.label}» талбарыг бөглөнө үү` };
      continue;
    }
    if (f.dataType === "number" && Number.isNaN(Number(raw))) return { error: `«${f.label}» тоо байх ёстой` };
    values.push({ fieldId: f.id, valueText: raw });
  }
  // Хянагч сонгоогүй бол хяналтад илгээх үед мета өгөгдлийн дүрмээр автоматаар чиглүүлнэ (lib/routing.ts)

  // Файлууд
  const files = formData.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  const stored: Awaited<ReturnType<typeof saveFile>>[] = [];
  try {
    for (const f of files) stored.push(await saveFile(f));
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Засах үед: зөвхөн үүсгэгч, зөвхөн Ноорог/Засварт буцаасан төлөвт
  let existing: { id: string; currentVersionNo: number; statusCode: string } | null = null;
  if (v.documentId) {
    const d = await prisma.document.findUnique({ where: { id: v.documentId }, include: { status: true, _count: { select: { attachments: true } } } });
    if (!d || d.createdById !== user.id || !["DRAFT", "RETURNED"].includes(d.status.code)) {
      return { error: "Энэ баримтыг засах боломжгүй (хяналтад илгээгдсэн эсвэл таных биш)" };
    }
    existing = { id: d.id, currentVersionNo: d.currentVersionNo, statusCode: d.status.code };
  }

  const draft = await prisma.documentStatus.findUniqueOrThrow({ where: { code: "DRAFT" } });
  const snapshot: Prisma.InputJsonValue = { title: v.title, summary: v.summary ?? null, fields: values };

  const docId = await prisma.$transaction(async (tx) => {
    let id: string;
    let versionNo: number;
    if (existing) {
      versionNo = existing.currentVersionNo + 1;
      await tx.document.update({
        where: { id: existing.id },
        data: {
          title: v.title,
          summary: v.summary ?? null,
          direction: v.direction,
          confidentiality: v.confidentiality,
          documentDate: v.documentDate ? new Date(v.documentDate) : null,
          currentVersionNo: versionNo,
        },
      });
      id = existing.id;
      await tx.documentFieldValue.deleteMany({ where: { documentId: id } });
      if (values.length) await tx.documentFieldValue.createMany({ data: values.map((x) => ({ ...x, documentId: id })) });
    } else {
      versionNo = 1;
      const created = await tx.document.create({
        data: {
          internalNumber: await issueInternalNumber(tx),
          documentTypeId: type.id,
          title: v.title,
          summary: v.summary,
          direction: v.direction,
          confidentiality: v.confidentiality,
          documentDate: v.documentDate ? new Date(v.documentDate) : null,
          statusId: draft.id,
          ownerDepartmentId: user.departmentId,
          createdById: user.id,
          fieldValues: { create: values },
        },
      });
      id = created.id;
    }

    // ФШ-21: «ажилтан» төрлийн талбарын утгыг баримт–ажилтан холбоос болгон хадгална (үүрэг = талбарын нэр)
    const empLinks = type.fields
      .filter((f) => f.dataType === "employee")
      .flatMap((f) => values.filter((x) => x.fieldId === f.id).map((x) => ({ documentId: id, employeeId: x.valueText, relationRole: f.label.slice(0, 50) })));
    await tx.documentEmployee.deleteMany({ where: { documentId: id } });
    if (empLinks.length) await tx.documentEmployee.createMany({ data: empLinks, skipDuplicates: true });

    const version = await tx.documentVersion.create({
      data: { documentId: id, versionNo, changeNote: existing ? "Зассан" : "Анхны хувилбар", createdById: user.id, snapshot },
    });
    const hasMain = await tx.attachment.count({ where: { documentId: id, isMain: true } });
    for (const [i, s] of stored.entries()) {
      await tx.attachment.create({ data: { ...s, documentId: id, versionId: version.id, isMain: !hasMain && i === 0, uploadedById: user.id } });
    }
    if (v.relatedId && v.relatedId !== id) {
      const exists = await tx.documentRelation.findFirst({ where: { sourceDocumentId: id, targetDocumentId: v.relatedId } });
      if (!exists) await tx.documentRelation.create({ data: { sourceDocumentId: id, targetDocumentId: v.relatedId, relationType: "Үндэслэсэн", createdById: user.id } });
    }
    await writeAudit(
      { userId: user.id, documentId: id, entityType: "document", entityId: id, action: existing ? "UPDATE" : "CREATE", newStatusId: existing ? undefined : draft.id, newValue: { version: versionNo } },
      tx,
    );
    return id;
  });

  // Дараагийн алхам: хяналтад илгээх эсвэл ирсэн бичгийг шууд бүртгэх
  if (v.intent !== "draft") {
    try {
      const action = v.intent === "register" ? "register_incoming" : existing?.statusCode === "RETURNED" ? "resubmit" : "submit";
      await performAction(user, docId, action, { reviewerId: v.reviewerId });
    } catch (e) {
      revalidatePath("/documents");
      if (e instanceof WorkflowError) redirect(`/documents/${docId}?msg=${encodeURIComponent("Хадгалсан боловч: " + e.message)}`);
      throw e;
    }
  }

  revalidatePath("/documents");
  redirect(`/documents/${docId}`);
}
