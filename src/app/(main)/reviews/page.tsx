import { ORG_NAME } from "@/lib/org";
import Link from "next/link";
import { Search, Paperclip, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { availableActions } from "@/lib/workflow";
import { fmtShort, fmtDate, shortName, personLabel, daysBetween, startOfToday, DECISION_LABELS } from "@/lib/format";
import { PageHeader, Card, StatusBadge, Tabs, Pill } from "@/components/ui";
import { ActionPanel } from "../documents/[id]/action-panel";
import { ReviewerEdit } from "../documents/[id]/reviewer-edit";

export const dynamic = "force-dynamic";

/** Shiidwer buriin ungu — FORWARDED-iig «Zaswart butsaasan» gej haruuldag baisan aldaag zasaw */
const DECISION_TONE: Record<string, "green" | "orange" | "navy" | "slate"> = { APPROVED: "green", RETURNED: "orange", FORWARDED: "navy", CANCELLED: "slate" };

type SP = Promise<{ tab?: string; id?: string; q?: string }>;

export default async function ReviewsPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePermission("document.review");
  const { tab = "pending", id, q } = await searchParams;
  const today = startOfToday();

  const docFilter = q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { internalNumber: { contains: q, mode: "insensitive" as const } }] } : {};

  const [pending, done, pendingCount] = await Promise.all([
    prisma.approval.findMany({
      where: { reviewerId: user.id, decision: "PENDING", document: docFilter },
      include: { document: { include: { documentType: true, createdBy: { include: { employee: true } } } } },
      orderBy: { document: { updatedAt: "asc" } },
    }),
    tab === "done"
      ? prisma.approval.findMany({
          where: { reviewerId: user.id, decision: { in: ["APPROVED", "RETURNED", "FORWARDED"] }, document: docFilter },
          include: { document: { include: { status: true, documentType: true } } },
          orderBy: { decidedAt: "desc" },
          take: 50,
        })
      : [],
    prisma.approval.count({ where: { reviewerId: user.id, decision: "PENDING" } }),
  ]);

  const selectedId = id ?? pending[0]?.documentId;
  const doc =
    tab === "pending" && selectedId
      ? await prisma.document.findUnique({
          where: { id: selectedId },
          include: {
            status: true,
            documentType: true,
            createdBy: { include: { employee: true } },
            fieldValues: { include: { field: true }, orderBy: { field: { displayOrder: "asc" } } },
            attachments: true,
            approvals: { where: { decision: "RETURNED" }, orderBy: { decidedAt: "desc" }, take: 1 },
          },
        })
      : null;
  const actions = doc ? await availableActions(user, doc) : [];
  // «Daraagiin hyanagch ruu shiljuuleh» tsonhond haragdah hyanagchid (BD-03, BD-04)
  const reviewers =
    doc && actions.some((a) => a.code === "forward")
      ? await prisma.user.findMany({
          where: { isActive: true, id: { notIn: [doc.createdById, user.id] }, roles: { some: { role: { permissions: { some: { permission: { code: "document.approve" } } } } } } },
          include: { employee: { include: { department: true } } },
          orderBy: { employee: { lastName: "asc" } },
        })
      : [];

  return (
    <div>
      <PageHeader crumbs={[["Хяналт, баталгаажуулалт"]]} title="Хяналт, баталгаажуулалт" subtitle="Таны хяналтад ирсэн баримтыг шалгаж шийдвэр гаргана" />
      <Tabs
        active={tab}
        tabs={[
          { key: "pending", label: `Хянах · ${pendingCount}`, href: "/reviews" },
          { key: "done", label: "Миний шийдвэрлэсэн", href: "/reviews?tab=done" },
        ]}
      />

      {tab === "done" ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/60"><tr><th className="th">Дугаар</th><th className="th">Гарчиг</th><th className="th">Төрөл</th><th className="th">Шийдвэр</th><th className="th">Тайлбар</th><th className="th">Огноо</th><th className="th">Одоогийн төлөв</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {done.map((a) => (
                <tr key={a.id}>
                  <td className="td font-semibold">{a.document.documentNumber ?? a.document.internalNumber}</td>
                  <td className="td"><Link href={`/documents/${a.documentId}`} className="link">{a.document.title}</Link></td>
                  <td className="td text-slate-600">{a.document.documentType.name}</td>
                  <td className="td"><Pill tone={DECISION_TONE[a.decision] ?? "slate"}>{DECISION_LABELS[a.decision] ?? a.decision}</Pill></td>
                  <td className="td max-w-72 truncate text-slate-600">{a.comment ?? "—"}</td>
                  <td className="td text-slate-600">{fmtDate(a.decidedAt)}</td>
                  <td className="td"><StatusBadge code={a.document.status.code} name={a.document.status.name} /></td>
                </tr>
              ))}
              {done.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">Одоогоор шийдвэрлэсэн баримт алга</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <div className="space-y-3">
            <form className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Дугаар, гарчгаар хайх…" className="input pl-9" />
            </form>
            {pending.map((a) => {
              const wait = daysBetween(a.document.updatedAt ?? a.document.createdAt, today);
              const active = a.documentId === selectedId;
              return (
                <Link key={a.id} href={`/reviews?id=${a.documentId}`} className={`block rounded-xl border bg-white p-4 transition ${active ? "border-navy-800 ring-1 ring-navy-800" : "border-slate-200 hover:border-slate-300"}`}>
                  <div className="flex justify-between text-xs text-slate-500"><span className="font-semibold text-slate-700">{a.document.internalNumber}</span><span>Илгээсэн: {fmtShort(a.document.updatedAt ?? a.document.createdAt)}</span></div>
                  <div className="mt-1 font-semibold">{a.document.title}</div>
                  <div className="text-xs text-slate-500">{a.document.documentType.name} · {personLabel(a.document.createdBy.employee)}</div>
                  <div className="mt-1 text-xs font-medium text-orange-700">{Math.max(wait, 0)} хоног хүлээж байна{a.stepOrder > 1 && " · дахин илгээсэн"}</div>
                </Link>
              );
            })}
            {pending.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Хянах баримт алга</p>}
            <p className="text-xs text-slate-400">Таны өөрийн үүсгэсэн баримт энэ жагсаалтад орохгүй.</p>
          </div>

          {doc ? (
            <div className="space-y-5">
              <Card title={`${doc.internalNumber} · ${doc.title}`} right={<StatusBadge code={doc.status.code} name={doc.status.name} />}>
                <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-[130px_1fr_130px_1fr]">
                  <dt className="text-slate-500">Төрөл</dt><dd className="font-medium">{doc.documentType.name} · Хувилбар {doc.currentVersionNo}</dd>
                  <dt className="text-slate-500">Үүсгэсэн</dt><dd className="font-medium">{personLabel(doc.createdBy.employee)}</dd>
                  {doc.fieldValues.slice(0, 4).map((v) => (
                    <div key={v.id} className="contents"><dt className="text-slate-500">{v.field.label}</dt><dd className="font-medium">{v.field.dataType === "employee" ? "Хүний нөөцөөс" : v.valueText}</dd></div>
                  ))}
                  {doc.approvals[0] && (
                    <div className="contents"><dt className="text-slate-500">Өмнөх шийдвэр</dt><dd className="font-medium md:col-span-3">{fmtShort(doc.approvals[0].decidedAt)} Засварт буцаасан: «{doc.approvals[0].comment}»</dd></div>
                  )}
                </dl>
                <div className="mt-4 rounded-xl bg-slate-100 p-4">
                  <div className="rounded border border-slate-200 bg-white px-8 py-6 font-serif text-[13px] leading-relaxed">
                    <p className="text-center font-bold uppercase">{ORG_NAME}</p>
                    <p className="text-center font-bold uppercase">{doc.documentType.name}</p>
                    <p className="mt-3 text-center font-bold">{doc.title}</p>
                    <p className="mt-3 whitespace-pre-wrap">{doc.summary || "—"}</p>
                  </div>
                </div>
                <Link href={`/documents/${doc.id}`} className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                  <Paperclip size={16} />
                  <span className="flex-1 text-sm"><b>{doc.attachments.length} хавсралт</b><span className="block truncate text-xs text-slate-500">{doc.attachments.map((a) => a.fileName).join(", ") || "Файлгүй"}</span></span>
                  <span className="flex items-center gap-1 text-sm font-semibold">Дэлгэрэнгүй харах <ArrowRight size={14} /></span>
                </Link>
              </Card>
              <Card title="Шийдвэр">
                <ActionPanel
                  key={doc.id}
                  documentId={doc.id}
                  actions={actions}
                  reviewers={reviewers.map((r) => ({ id: r.id, name: `${shortName(r.employee)} — ${r.employee.department.name}` }))}
                  compact
                  signer={`${user.fullName}${user.roles[0] ? ` · ${user.roles[0].name}` : ""}`}
                  documentLabel={`«${doc.title}» · ${doc.internalNumber}`}
                />
                {actions.some((a) => a.code === "approve") && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <ReviewerEdit
                      key={`e-${doc.id}-${doc.currentVersionNo}`}
                      documentId={doc.id}
                      title={doc.title}
                      summary={doc.summary ?? ""}
                      fields={doc.fieldValues.map((v) => ({ id: v.fieldId, label: v.field.label, dataType: v.field.dataType, value: v.valueText, options: Array.isArray(v.field.options) ? (v.field.options as string[]) : [] }))}
                    />
                  </div>
                )}
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Батлахад систем албан ёсны дугаарыг автоматаар олгоно. Шийдвэр төлөвийн түүх болон аудитад хадгалагдана.</p>
              </Card>
            </div>
          ) : (
            <div className="card flex items-center justify-center p-16 text-sm text-slate-500">Зүүн талаас баримт сонгоно уу</div>
          )}
        </div>
      )}
    </div>
  );
}
