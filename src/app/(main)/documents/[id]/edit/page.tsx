import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { fileSize } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { DocumentForm } from "../../document-form";
import { loadFormData } from "../../form-data";

export const dynamic = "force-dynamic";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("document.create");
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      status: true,
      fieldValues: true,
      attachments: true,
      approvals: { where: { decision: "RETURNED" }, orderBy: { decidedAt: "desc" }, take: 1 },
    },
  });
  if (!doc || doc.createdById !== user.id) notFound();
  if (!["DRAFT", "RETURNED"].includes(doc.status.code)) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-700">«{doc.status.name}» төлөвтэй баримтыг засах боломжгүй.</p>
        <Link href={`/documents/${doc.id}`} className="btn-outline mt-4">Баримт руу буцах</Link>
      </div>
    );
  }
  const data = await loadFormData(user, doc.documentTypeId);
  if (!data) notFound();

  return (
    <div>
      <PageHeader
        crumbs={[["Баримт бичиг", "/documents"], [doc.internalNumber, `/documents/${doc.id}`], ["Засах"]]}
        title="Баримт засах"
        subtitle={<>Дотоод дугаар: {doc.internalNumber} · <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">{doc.status.name}</span> · Хувилбар {doc.currentVersionNo}</>}
        actions={<Link href={`/documents/${doc.id}`} className="btn-outline">Болих</Link>}
      />
      <DocumentForm
        {...data}
        initial={{
          documentId: doc.id,
          title: doc.title,
          summary: doc.summary ?? "",
          direction: doc.direction,
          confidentiality: doc.confidentiality,
          documentDate: doc.documentDate?.toISOString().slice(0, 10),
          values: Object.fromEntries(doc.fieldValues.map((v) => [v.fieldId, v.valueText])),
          attachments: doc.attachments.map((a) => ({ name: a.fileName, size: fileSize(a.fileSize) })),
          returnedComment: doc.status.code === "RETURNED" ? doc.approvals[0]?.comment : null,
        }}
      />
    </div>
  );
}
