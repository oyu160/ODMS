import { ORG_NAME } from "@/lib/org";
import Link from "next/link";
import { notFound, forbidden } from "next/navigation";
import { Download, Pencil, File as FileIcon, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, can } from "@/lib/auth";
import { documentScope } from "@/lib/access";
import { availableActions, AUDIT_LABELS, SEND_METHODS } from "@/lib/workflow";
import { CONF_LABELS, DIRECTION_LABELS, ASSIGNMENT_LABELS, DECISION_LABELS, fmtDate, fmtDateTime, fmtShort, shortName, personLabel, fileSize, startOfToday, daysBetween, describeAuditValue, RELATION_TYPES, RELATION_INVERSE } from "@/lib/format";
import { PageHeader, Card, StatusBadge, Tabs, Pill, STATUS_COLOR } from "@/components/ui";
import { ActionPanel } from "./action-panel";
import { WorkflowSteps, NextStep } from "@/components/workflow-steps";
import { ReviewerEdit } from "./reviewer-edit";
import { addRelation, removeRelation } from "./actions";
import { ModalButton, ModalCloser, ConfirmButton } from "@/components/modal";
import { SubmitButton } from "@/components/feedback";
import { verifyDocumentSignatures } from "@/lib/signature";
import { resolveRoute } from "@/lib/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; msg?: string }>;

export default async function DocumentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const { tab = "info", msg } = await searchParams;
  const user = await requireUser();

  const doc = await prisma.document.findFirst({
    where: { AND: [{ id }, documentScope(user)] },
    include: {
      status: true,
      documentType: { include: { category: true } },
      ownerDepartment: true,
      createdBy: { include: { employee: true } },
      fieldValues: { include: { field: true }, orderBy: { field: { displayOrder: "asc" } } },
      attachments: { include: { uploadedBy: { include: { employee: true } } }, orderBy: { uploadedAt: "asc" } },
      versions: { include: { createdBy: { include: { employee: true } } }, orderBy: { versionNo: "desc" } },
      approvals: { include: { reviewer: { include: { employee: true } } }, orderBy: { stepOrder: "asc" } },
      assignments: { include: { assigneeUser: { include: { employee: true } }, assigneeDepartment: true, assignedBy: { include: { employee: true } } }, orderBy: { assignedAt: "desc" } },
      relationsFrom: { include: { target: { include: { status: true } } } },
      relationsTo: { include: { source: { include: { status: true } } } },
      archive: { include: { archivedBy: { include: { employee: true } } } },
      dispatch: { include: { sentBy: { include: { employee: true } } } },
      auditLogs: { include: { user: { include: { employee: true } }, newStatus: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!doc) {
    // FBSh-02: barimt baigaa bolowch hereglegchiin erhiin hureend bish bol 403
    const exists = await prisma.document.count({ where: { id, isDeleted: false } });
    if (exists) forbidden();
    notFound();
  }

  const empIds = doc.fieldValues.filter((v) => v.field.dataType === "employee").map((v) => v.valueText);
  const emps = empIds.length ? await prisma.employee.findMany({ where: { id: { in: empIds } }, include: { department: true } }) : [];
  const showValue = (dataType: string, value: string) => {
    if (dataType !== "employee") return dataType === "date" ? value.replace(/-/g, ".") : value;
    const e = emps.find((x) => x.id === value);
    return e ? (
      <>
        {shortName(e)} · {e.department.name} <Pill tone="navy">Хүний нөөц</Pill>
      </>
    ) : value;
  };

  const actions = await availableActions(user, doc);
  const codes = new Set(actions.map((a) => a.code));
  const [reviewers, users, departments] = await Promise.all([
    codes.has("submit") || codes.has("resubmit") || codes.has("forward")
      ? prisma.user.findMany({
          where: { isActive: true, id: { notIn: codes.has("forward") ? [doc.createdById, user.id] : [doc.createdById] }, roles: { some: { role: { permissions: { some: { permission: { code: "document.approve" } } } } } } },
          include: { employee: { include: { department: true } } },
        })
      : [],
    codes.has("assign") || codes.has("reassign")
      ? prisma.user.findMany({ where: { isActive: true, employee: { employmentStatus: "ACTIVE" } }, include: { employee: { include: { department: true } } }, orderBy: { employee: { lastName: "asc" } } })
      : [],
    codes.has("assign") || codes.has("reassign") ? prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : [],
  ]);

  // Meta ugugdliin durmeer awtomataar songogdoh hyanagch (hyanaltad ilgeeh tsonhond haruulna)
  const autoRule =
    codes.has("submit") || codes.has("resubmit")
      ? await resolveRoute(prisma, { ...doc, fields: doc.fieldValues.map((v) => ({ fieldId: v.fieldId, valueText: v.valueText })) })
      : null;
  const autoReviewer = autoRule ? reviewers.find((r) => r.id === autoRule.reviewerId) : undefined;

  // Tsahim gariin usgiin shalgalt: aguulga uurchlugduugui, gariin useg jinhene eseh
  const signatures = doc.approvedAt ? await verifyDocumentSignatures(doc.id) : [];
  // Tsutslagdsan gariin useg ni huchingui bolowch aldaa bish — idewhtei gariin usgiig shalgana
  const activeSigs = signatures.filter((x) => x.status !== "REVOKED");
  const sigOk = activeSigs.length > 0 && activeSigs.every((x) => x.status === "VALID");

  const editable = doc.createdById === user.id && ["DRAFT", "RETURNED"].includes(doc.status.code);
  // FSh-22: barimt bichgiin ajiltan eswel uusgegch hamaaral nemne
  const canRelate = can(user, "document.register") || doc.createdById === user.id;
  const relationCandidates = canRelate
    ? await prisma.document.findMany({
        where: { AND: [documentScope(user), { id: { not: doc.id } }] },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: { id: true, documentNumber: true, internalNumber: true, title: true },
      })
    : [];

  // Daraagiin alham: hen, yuu hiih we
  const pendingReview = doc.approvals.find((a) => a.decision === "PENDING");
  const activeAssign = doc.assignments.find((a) => a.status === "ACTIVE");
  const creatorName = shortName(doc.createdBy.employee);
  const assigneeName = activeAssign ? (activeAssign.assigneeUser ? shortName(activeAssign.assigneeUser.employee) : `${activeAssign.assigneeDepartment?.name} (нэгж)`) : "";
  const outgoing = doc.direction === "OUTGOING";
  const recipientOrg = doc.fieldValues.find((v) => v.field.name === "recipient_org")?.valueText;
  const replyTo = doc.fieldValues.find((v) => v.field.name === "reply_to")?.valueText;
  const next: Record<string, string | null> = {
    DRAFT: doc.direction === "INCOMING" ? "Баримт бичгийн ажилтан ирсэн бичгийг бүртгэж дугаар олгоно." : `${creatorName} баримтаа бөглөж хянагч сонгоод хяналтад илгээнэ.`,
    IN_REVIEW: `${pendingReview ? shortName(pendingReview.reviewer.employee) : "Хянагч"} хянаж, батлах эсвэл засварт буцаана.`,
    RETURNED: `${creatorName} хянагчийн тайлбарын дагуу засаад дахин илгээнэ.`,
    APPROVED: "Баримт бичгийн ажилтан батлагдсан баримтыг бүртгэнэ.",
    REGISTERED: outgoing
      ? `Баримт бичгийн ажилтан бичгийг ${recipientOrg ? `${recipientOrg}-д ` : "хүлээн авагч руу "}илгээж, илгээлтийг бүртгэнэ.`
      : "Баримт бичгийн ажилтан хариуцагчид хуваарилна, эсвэл шууд архивлана.",
    SENT: "Хүлээн авагч руу илгээгдсэн. Баримт бичгийн ажилтан архивлана.",
    ASSIGNED: `${assigneeName} ${activeAssign?.dueDate ? fmtDate(activeAssign.dueDate) + "-ний дотор" : ""} шийдвэрлэнэ.`,
    RESOLVED: "Баримт бичгийн ажилтан архивлана.",
    ARCHIVED: null,
    CANCELLED: null,
  };
  const myTurn = actions.length > 0;
  const mainFile = doc.attachments.find((a) => a.isMain) ?? doc.attachments[0];
  const statusLogs = doc.auditLogs.filter((l) => l.newStatus);
  const today = startOfToday();
  const relations = [
    ...doc.relationsFrom.map((r) => ({ id: r.id, doc: r.target, type: r.relationType, own: true })),
    ...doc.relationsTo.map((r) => ({ id: r.id, doc: r.source, type: RELATION_INVERSE[r.relationType] ?? r.relationType, own: false })),
  ];

  const info: [string, React.ReactNode][] = [
    ["Албан ёсны дугаар", doc.documentNumber ? <b>{doc.documentNumber}</b> : <i className="text-slate-500">Батлагдсаны дараа олгоно</i>],
    ["Ангилал", doc.documentType.category.name],
    ["Чиглэл", DIRECTION_LABELS[doc.direction]],
    ...doc.fieldValues.map((v) => [v.field.label, showValue(v.field.dataType, v.valueText)] as [string, React.ReactNode]),
    ["Баримтын огноо", fmtDate(doc.documentDate)],
    ["Үүсгэсэн", `${personLabel(doc.createdBy.employee)} · ${fmtDate(doc.createdAt)}`],
    ["Хариуцах нэгж", doc.ownerDepartment.name],
    ["Нууцлалын түвшин", CONF_LABELS[doc.confidentiality] ?? doc.confidentiality],
  ];

  return (
    <div>
      <PageHeader
        crumbs={[["Баримт бичиг", "/documents"], [doc.documentNumber ?? doc.internalNumber]]}
        title={doc.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {doc.documentNumber ? `${doc.documentNumber} · ` : ""}
            {doc.internalNumber} (дотоод дугаар) · {doc.documentType.name} · Хувилбар {doc.currentVersionNo} ·
            <StatusBadge code={doc.status.code} name={doc.status.name} />
            {activeSigs.length > 0 &&
              (sigOk ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-200"><ShieldCheck size={12} /> Цахим гарын үсгээр баталгаажсан</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200"><ShieldAlert size={12} /> Гарын үсгийн шалгалт амжилтгүй</span>
              ))}
          </span>
        }
        actions={
          <>
            {editable && <Link href={`/documents/${doc.id}/edit`} className="btn-outline"><Pencil size={16} /> Засах</Link>}
            {mainFile && <a href={`/api/files/${mainFile.id}?download=1`} className="btn-outline"><Download size={16} /> Татах</a>}
          </>
        }
      />

      <div className="card mb-5 p-4">
        <WorkflowSteps status={doc.status.code} direction={doc.direction} visited={statusLogs.map((l) => l.newStatus!.code)} />
        <NextStep text={next[doc.status.code] ?? null} mine={myTurn} />
      </div>

      {msg && <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{msg}</p>}

      <Tabs
        active={tab}
        tabs={[
          { key: "info", label: "Дэлгэрэнгүй", href: `/documents/${doc.id}` },
          { key: "versions", label: `Хувилбарын түүх (${doc.versions.length})`, href: `/documents/${doc.id}?tab=versions` },
          { key: "history", label: "Үйлдлийн түүх", href: `/documents/${doc.id}?tab=history` },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {tab === "info" && (
            <>
              <Card title="Баримтын мэдээлэл">
                <dl className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2.5 text-sm">
                  {info.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-medium text-slate-900">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 rounded-xl bg-slate-100 p-4">
                  <div className="rounded border border-slate-200 bg-white px-8 py-7 font-serif text-sm leading-relaxed text-slate-800">
                    <p className="text-center font-bold uppercase">{ORG_NAME}</p>
                    <p className="text-center font-bold uppercase">{doc.documentType.name}</p>
                    <div className="mt-3 flex justify-between text-xs">
                      <span>{fmtDate(doc.documentDate)}</span>
                      <span>Дугаар {doc.documentNumber ?? <i className="text-slate-500">[батлагдсаны дараа]</i>}</span>
                      <span>Улаанбаатар хот</span>
                    </div>
                    {outgoing && recipientOrg && <p className="mt-4 text-right font-bold uppercase">{recipientOrg}</p>}
                    {outgoing && replyTo && <p className="mt-2 text-xs">Танай {replyTo} тоот албан бичгийн хариу</p>}
                    <p className="mt-4 text-center font-bold">{doc.title}</p>
                    <p className="mt-3 whitespace-pre-wrap">{doc.summary || <i className="text-slate-500">Агуулга оруулаагүй</i>}</p>
                  </div>
                </div>
              </Card>

              <Card title="Хавсралт" right={<span className="text-slate-500">{doc.attachments.length} файл</span>}>
                {doc.attachments.length === 0 && <p className="text-sm text-slate-500">Файл хавсаргаагүй.</p>}
                <ul className="space-y-2">
                  {doc.attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                      <FileIcon size={18} className="text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{a.fileName}{a.isMain && <span className="ml-2 text-xs font-normal text-slate-500">үндсэн</span>}</div>
                        <div className="text-xs text-slate-500">{fileSize(a.fileSize)} · {shortName(a.uploadedBy.employee)} · {fmtShort(a.uploadedAt)}</div>
                      </div>
                      <a href={`/api/files/${a.id}`} target="_blank" className="text-sm font-semibold link">Үзэх</a>
                      <span className="text-slate-300">·</span>
                      <a href={`/api/files/${a.id}?download=1`} className="text-sm font-semibold link">Татах</a>
                    </li>
                  ))}
                </ul>
              </Card>

              {doc.assignments.length > 0 && (
                <Card title="Хуваарилалт">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-100"><th className="th px-0">Хариуцагч</th><th className="th">Хуваарилсан</th><th className="th">Хугацаа</th><th className="th">Төлөв</th><th className="th">Үр дүн</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {doc.assignments.map((a) => {
                        const late = a.status === "ACTIVE" && a.dueDate && a.dueDate < today;
                        return (
                          <tr key={a.id}>
                            <td className="py-3 text-sm font-medium">{a.assigneeUser ? shortName(a.assigneeUser.employee) : <>{a.assigneeDepartment?.name} <Pill>Нэгж</Pill></>}</td>
                            <td className="td text-slate-600">{shortName(a.assignedBy.employee)} · {fmtShort(a.assignedAt)}</td>
                            <td className={`td ${late ? "font-semibold text-red-700" : "text-slate-600"}`}>{fmtDate(a.dueDate)}{late && ` (${daysBetween(a.dueDate!, today)} хоног хэтэрсэн)`}</td>
                            <td className="td"><Pill tone={a.status === "DONE" ? "green" : a.status === "ACTIVE" ? "navy" : "slate"}>{ASSIGNMENT_LABELS[a.status] ?? a.status}</Pill></td>
                            <td className="td text-slate-600">{a.resultNote ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )}

              {outgoing && (
                <Card title="Илгээлтийн мэдээлэл">
                  {doc.dispatch ? (
                    <dl className="grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                      <dt className="text-slate-500">Хүлээн авагч</dt><dd className="font-medium">{doc.dispatch.recipient}</dd>
                      <dt className="text-slate-500">Илгээсэн огноо</dt><dd>{fmtDate(doc.dispatch.sentAt)}</dd>
                      <dt className="text-slate-500">Хэлбэр</dt><dd>{SEND_METHODS[doc.dispatch.method] ?? doc.dispatch.method}</dd>
                      <dt className="text-slate-500">Хүлээн авсан</dt><dd>{doc.dispatch.receiptRef ?? "—"}</dd>
                      <dt className="text-slate-500">Илгээсэн ажилтан</dt><dd>{shortName(doc.dispatch.sentBy.employee)}</dd>
                      {doc.dispatch.note && <><dt className="text-slate-500">Тайлбар</dt><dd>{doc.dispatch.note}</dd></>}
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {["REGISTERED"].includes(doc.status.code) ? "Бүртгэгдсэн, хүлээн авагч руу хараахан илгээгээгүй." : doc.status.code === "ARCHIVED" || doc.status.code === "CANCELLED" ? "Илгээлтийн бүртгэл байхгүй." : "Батлагдаж бүртгэгдсэний дараа илгээнэ."}
                    </p>
                  )}
                </Card>
              )}

              {doc.archive && (
                <Card title="Архивын мэдээлэл">
                  <dl className="grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                    <dt className="text-slate-500">Архивласан</dt><dd>{shortName(doc.archive.archivedBy.employee)} · {fmtDate(doc.archive.archivedAt)}</dd>
                    <dt className="text-slate-500">Ангилал</dt><dd>{doc.archive.archiveCategory ?? "—"}</dd>
                    <dt className="text-slate-500">Хадгалах хугацаа</dt><dd>{fmtDate(doc.archive.retentionUntil)} хүртэл</dd>
                    <dt className="text-slate-500">Дараах шийдвэр</dt><dd>{doc.archive.disposalAction === "TRANSFER" ? "Улсын архивт шилжүүлэх" : "Устгах"}</dd>
                    <dt className="text-slate-500">Байршил</dt><dd>{doc.archive.storageLocation ?? "—"}</dd>
                  </dl>
                </Card>
              )}
            </>
          )}

          {tab === "versions" && (
            <Card title="Хувилбарын түүх">
              <ol className="space-y-4">
                {doc.versions.map((v) => {
                  const snap = (v.snapshot ?? {}) as { title?: string; summary?: string | null };
                  return (
                    <li key={v.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Хувилбар {v.versionNo}{v.versionNo === doc.currentVersionNo && <Pill tone="navy">одоогийн</Pill>}</span>
                        <span className="text-xs text-slate-500">{personLabel(v.createdBy.employee)} · {fmtDateTime(v.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{v.changeNote}</div>
                      {snap.title && <div className="mt-2 text-sm"><span className="text-slate-500">Гарчиг:</span> {snap.title}</div>}
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          {tab === "history" && (
            <Card title="Үйлдлийн түүх (аудит)">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100"><th className="th px-0">Огноо</th><th className="th">Хэрэглэгч</th><th className="th">Үйлдэл</th><th className="th">Төлөв</th><th className="th">Дэлгэрэнгүй</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {doc.auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 text-sm text-slate-600">{fmtDateTime(l.createdAt)}</td>
                      <td className="td">{shortName(l.user.employee)}</td>
                      <td className="td font-medium">{AUDIT_LABELS[l.action] ?? l.action}</td>
                      <td className="td">{l.newStatus ? <StatusBadge code={l.newStatus.code} name={l.newStatus.name} /> : "—"}</td>
                      <td className="td text-xs text-slate-600">{describeAuditValue(l.newValue).map((d) => `${d.label}: ${d.value}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card title={codes.has("approve") ? "Хяналтын шийдвэр" : "Үйлдэл"}>
            <ActionPanel
              documentId={doc.id}
              actions={actions}
              reviewers={[...reviewers]
                // BD-03: anhdagchaar uusgegchiin negjiin udirdlaga ehend
                .sort((a, b) => Number(b.employee.departmentId === doc.createdBy.employee.departmentId) - Number(a.employee.departmentId === doc.createdBy.employee.departmentId))
                .map((r) => ({ id: r.id, name: `${shortName(r.employee)} — ${r.employee.department.name}` }))}
              users={users.map((u) => ({ id: u.id, name: `${shortName(u.employee)} — ${u.employee.department.name}` }))}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              defaultArchiveCategory={doc.documentType.name}
              defaultRecipient={recipientOrg}
              autoReviewer={autoRule && autoReviewer ? { name: `${shortName(autoReviewer.employee)} — ${autoReviewer.employee.department.name}`, rule: autoRule.name } : null}
              signer={`${user.fullName}${user.roles[0] ? ` · ${user.roles[0].name}` : ""}`}
              documentLabel={`«${doc.title}» · ${doc.documentNumber ?? doc.internalNumber}`}
            />
            {codes.has("approve") && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ReviewerEdit
                  documentId={doc.id}
                  title={doc.title}
                  summary={doc.summary ?? ""}
                  fields={doc.fieldValues.map((v) => ({ id: v.fieldId, label: v.field.label, dataType: v.field.dataType, value: v.valueText, options: Array.isArray(v.field.options) ? (v.field.options as string[]) : [] }))}
                />
              </div>
            )}
          </Card>

          <Card title="Төлөвийн түүх">
            <ol className="space-y-4">
              {statusLogs.map((l, i) => {
                const comment = (l.newValue as { comment?: string } | null)?.comment;
                return (
                  <li key={l.id} className="flex gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: i === 0 ? STATUS_COLOR[l.newStatus!.code] : "#cbd5e1" }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{l.newStatus!.name}</div>
                      <div className="text-xs text-slate-500">{fmtDateTime(l.createdAt).slice(5)} · {shortName(l.user.employee)} · {(AUDIT_LABELS[l.action] ?? l.action).toLowerCase()}</div>
                      {comment && <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">{comment}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {signatures.length > 0 && (
            <Card title="Цахим гарын үсэг">
              <ul className="space-y-3">
                {signatures.map((x) => (
                  <li key={x.id} className={`rounded-lg border p-3 text-sm ${x.status === "VALID" ? "border-green-200 bg-green-50/60" : x.status === "REVOKED" ? "border-slate-200 bg-slate-50 text-slate-500" : "border-red-200 bg-red-50"}`}>
                    <div className="flex items-center gap-2 font-semibold">
                      {x.status === "VALID" ? <ShieldCheck size={16} className="text-green-700" /> : <ShieldAlert size={16} className={x.status === "REVOKED" ? "text-slate-500" : "text-red-700"} />}
                      {x.signerName}
                    </div>
                    <div className={`mt-1 text-xs ${x.status === "VALID" ? "text-green-800" : x.status === "REVOKED" ? "text-slate-500" : "text-red-700"}`}>{x.message}</div>
                    <div className="mt-1 text-xs text-slate-500">{fmtDateTime(x.signedAt)} · түлхүүр {x.fingerprint}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">Ed25519 · SHA-256. Байгууллагын дотоод цахим гарын үсэг (итгэмжлэгдсэн гэрчилгээний төвийн гэрчилгээгүй).</p>
            </Card>
          )}

          {doc.approvals.length > 0 && (
            <Card title="Хяналтын шатууд">
              <ul className="space-y-2 text-sm">
                {doc.approvals.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>{a.stepOrder}. {shortName(a.reviewer.employee)}</span>
                    <Pill tone={a.decision === "APPROVED" ? "green" : a.decision === "RETURNED" ? "amber" : a.decision === "PENDING" ? "navy" : "slate"}>{DECISION_LABELS[a.decision]}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title="Холбоотой баримт"
            right={
              canRelate && (
                <ModalButton label="+ Нэмэх" title="Баримт холбох" description="Жишээ нь ирсэн бичгийн хариуг «Хариу», батлагдсан баримтыг өөрчилсөн шинэ баримтыг «Өөрчилсөн» хамаарлаар холбоно." className="text-sm font-semibold link">
                  <form action={addRelation} className="space-y-4">
                    <ModalCloser />
                    <input type="hidden" name="documentId" value={doc.id} />
                    <div>
                      <label className="label" htmlFor="rel-type">Энэ баримт нь… <span className="text-red-600">*</span></label>
                      <select id="rel-type" name="relationType" required className="input" defaultValue="Хариу">
                        {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="rel-target">Холбох баримт <span className="text-red-600">*</span></label>
                      <select id="rel-target" name="targetId" required className="input" defaultValue="">
                        <option value="" disabled>— Баримт сонгох —</option>
                        {relationCandidates.map((d) => <option key={d.id} value={d.id}>{d.documentNumber ?? d.internalNumber} · {d.title}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">Таны харах эрхтэй сүүлийн 300 баримт.</p>
                    </div>
                    <SubmitButton className="btn-primary w-full" pendingText="Холбож байна…">Холбох</SubmitButton>
                  </form>
                </ModalButton>
              )
            }
          >
            {relations.length === 0 && <p className="text-sm text-slate-500">Холбоос алга</p>}
            <ul className="space-y-3">
              {relations.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/documents/${r.doc.id}`} className="text-sm font-semibold link">{r.doc.documentNumber ?? r.doc.internalNumber} · {r.doc.title}</Link>
                    <div className="text-xs text-slate-500">{r.type} · {r.doc.status.name}</div>
                  </div>
                  {r.own && canRelate && (
                    <ConfirmButton
                      action={removeRelation}
                      fields={{ relationId: r.id, documentId: doc.id }}
                      className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Хамаарлыг хасах уу?"
                      description={`«${r.type}» хамаарал хасагдана. Баримтууд өөрсдөө хэвээр үлдэх ба хасалт аудитад бүртгэгдэнэ.`}
                      confirmLabel="Хасах"
                    >
                      <X size={14} aria-label="Хамаарал хасах" />
                    </ConfirmButton>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {can(user, "audit.view") && <p className="text-xs text-slate-500">Баримтын ID: {doc.id}</p>}
        </aside>
      </div>
    </div>
  );
}
