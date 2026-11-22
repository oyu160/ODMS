"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { startOfToday } from "@/lib/format";

/**
 * BD-15: hadgalah hugatsaa duussan arhiwiin barimtad shiidwer gargah.
 * DESTROY — barimtiig sistemees ustgasand tootsno (is_deleted = true, ugugdul auditiin zorilgoor uldene).
 * TRANSFER — ulsiin arhiwt shiljuulsen gej temdeglene.
 * Shiidwer neg udaa garna, butsaahgui; temdeglel (akt, tushaaliin dugaar g.m.) zaawal.
 */
export async function disposeArchive(formData: FormData) {
  const user = await requireUser();
  const back = (msg: string): never => redirect(`/archive?retention=expired&err=${encodeURIComponent(msg)}`);
  if (!can(user, "document.archive")) back("Архивын шийдвэр гаргах эрхгүй байна");

  const id = String(formData.get("archiveId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (decision !== "DESTROY" && decision !== "TRANSFER") back("Шийдвэрийн төрлийг сонгоно уу");
  if (note.length < 3) back("Шийдвэрийн үндэслэл (акт, тушаалын дугаар)-ыг бичнэ үү");

  const a = await prisma.archive.findUnique({ where: { id }, include: { document: { select: { documentNumber: true, internalNumber: true } } } });
  if (!a) back("Архивын бичлэг олдсонгүй");
  if (a!.disposedAt) back("Энэ баримтад шийдвэр аль хэдийн гарсан байна");
  if (!a!.retentionUntil || a!.retentionUntil >= startOfToday()) back("Хадгалах хугацаа дуусаагүй баримтад шийдвэр гаргах боломжгүй");

  await prisma.$transaction(async (tx) => {
    await tx.archive.update({ where: { id }, data: { disposalAction: decision, disposedAt: new Date(), disposedById: user.id, disposalNote: note } });
    if (decision === "DESTROY") await tx.document.update({ where: { id: a!.documentId }, data: { isDeleted: true } });
    await writeAudit(
      {
        userId: user.id,
        documentId: a!.documentId,
        entityType: "archive",
        entityId: id,
        action: "DISPOSE",
        newValue: { decision: decision === "DESTROY" ? "Устгасан" : "Улсын архивт шилжүүлсэн", note, document: a!.document.documentNumber ?? a!.document.internalNumber },
      },
      tx,
    );
  });
  revalidatePath("/archive");
  redirect(`/archive?msg=${encodeURIComponent(decision === "DESTROY" ? "Баримтыг устгасан шийдвэр бүртгэгдлээ" : "Улсын архивт шилжүүлсэн шийдвэр бүртгэгдлээ")}`);
}
