import Link from "next/link";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/auth";
import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { DocumentForm } from "../document-form";
import { loadFormData } from "../form-data";

export const dynamic = "force-dynamic";

type SP = Promise<{ type?: string; direction?: string }>;

export default async function NewDocumentPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePermission("document.create");
  const sp = await searchParams;
  const canRegister = can(user, "document.register");
  if (sp.direction === "INCOMING" && !canRegister) forbidden();
  // Dotood hawtasnaas orwol irsen/yawsan bichgiin turul haragdahgui; burtgeh erhgui bol irsen bichig haragdahgui
  const hiddenTypes = [...(canRegister ? [] : ["INCOMING"]), ...(sp.direction === "INTERNAL" ? ["INCOMING", "OUTGOING"] : [])];

  // 1-r alham: turul songoh
  if (!sp.type) {
    const cats = await prisma.documentCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { types: { where: { isActive: true, code: { notIn: hiddenTypes } }, orderBy: { name: "asc" }, include: { _count: { select: { fields: true } } } } },
    });
    const dirQ = sp.direction ? `&direction=${sp.direction}` : "";
    return (
      <div>
        <PageHeader crumbs={[["Баримт бичиг", "/documents"], ["Баримт үүсгэх"]]} title={sp.direction === "INCOMING" ? "Ирсэн бичиг бүртгэх" : "Баримт үүсгэх"} subtitle="Эхлээд баримтын төрлийг сонгоно уу" />
        <div className="space-y-6">
          {cats.filter((c) => c.types.length).map((c) => (
            <section key={c.id}>
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">{c.name.toUpperCase()}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {c.types.map((t) => (
                  <Link key={t.id} href={`/documents/new?type=${t.id}${dirQ}`} className="card flex items-center gap-3 p-4 transition hover:border-navy-600 hover:shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-800"><FileText size={18} /></span>
                    <span>
                      <span className="block font-semibold">{t.name}</span>
                      <span className="text-xs text-slate-500">{t._count.fields} нэмэлт талбар</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  const data = await loadFormData(user, sp.type);
  if (!data) return <p>Баримтын төрөл олдсонгүй</p>;
  if (data.type.code === "INCOMING" && !canRegister) forbidden();
  const direction = sp.direction ?? (data.type.code === "INCOMING" ? "INCOMING" : data.type.code === "OUTGOING" ? "OUTGOING" : "INTERNAL");

  return (
    <div>
      <PageHeader
        crumbs={[["Баримт бичиг", "/documents"], ["Баримт үүсгэх"]]}
        title={direction === "INCOMING" ? "Ирсэн бичиг бүртгэх" : "Баримт үүсгэх"}
        subtitle={<>Дотоод дугаар хадгалах үед олгогдоно · <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">Ноорог</span></>}
        actions={<Link href="/documents" className="btn-outline">Цуцлах</Link>}
      />
      <DocumentForm {...data} initial={{ direction }} />
    </div>
  );
}
