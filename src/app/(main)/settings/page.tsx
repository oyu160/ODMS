import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { formatNumber } from "@/lib/numbering";
import { ACTION_LABELS } from "@/lib/workflow";
import { PageHeader, Card, Tabs, Pill } from "@/components/ui";
import { saveType, saveField, moveField, deleteField, saveCategory, saveRule, saveRoutingRule, deleteRoutingRule } from "./actions";
import { DATA_TYPE_LABELS, CONF_LABELS, DIRECTION_LABELS, shortName } from "@/lib/format";
import { SubmitButton, Toast } from "@/components/feedback";
import { ConfirmButton, ModalButton, ModalCloser } from "@/components/modal";

export const dynamic = "force-dynamic";

type SP = Promise<{ tab?: string; type?: string; msg?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("settings.manage");
  const { tab = "types", type: typeId, msg } = await searchParams;

  const [cats, rules] = await Promise.all([
    prisma.documentCategory.findMany({ orderBy: { name: "asc" }, include: { types: { orderBy: { name: "asc" }, include: { _count: { select: { documents: true } } } } } }),
    prisma.numberingRule.findMany({ include: { types: true }, orderBy: { pattern: "asc" } }),
  ]);
  const allTypes = cats.flatMap((c) => c.types);
  const isNew = typeId === "new";
  const targetId = isNew ? undefined : allTypes.find((t) => t.id === typeId)?.id ?? allTypes[0]?.id;
  const current = targetId
    ? await prisma.documentType.findUnique({ where: { id: targetId }, include: { fields: { orderBy: { displayOrder: "asc" } }, category: true } })
    : null;

  return (
    <div>
      <PageHeader
        crumbs={[["Тохиргоо"], ["Баримтын тохиргоо"]]}
        title="Баримтын тохиргоо"
        subtitle="Баримтын ангилал, төрөл, маягтын талбар, дугаарлалтыг програмын кодыг өөрчлөхгүйгээр тохируулна"
      />
      {msg && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{msg}</p>}
      <Toast message={msg} />
      <Tabs
        active={tab}
        tabs={[
          { key: "types", label: "Төрөл ба маягт", href: "/settings" },
          { key: "categories", label: "Ангилал", href: "/settings?tab=categories" },
          { key: "numbering", label: "Дугаарлалт", href: "/settings?tab=numbering" },
          { key: "transitions", label: "Төлөвийн шилжилт", href: "/settings?tab=transitions" },
          { key: "routing", label: "Автомат чиглүүлэлт", href: "/settings?tab=routing" },
        ]}
      />

      {tab === "types" && (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          <Card title="Баримтын төрөл" right={<Link href="/settings?type=new" className="font-semibold text-navy-800">+ Нэмэх</Link>}>
            <div className="space-y-4">
              {cats.map((c) => (
                <div key={c.id}>
                  <div className="mb-1 text-xs font-semibold tracking-wider text-slate-500">{c.name.toUpperCase()}</div>
                  {c.types.map((t) => (
                    <Link key={t.id} href={`/settings?type=${t.id}`} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${current?.id === t.id ? "bg-navy-50 font-semibold" : "hover:bg-slate-50"} ${t.isActive ? "" : "text-slate-400"}`}>
                      <span>{t.name}</span>
                      <span className="text-xs text-slate-400">{t._count.documents}{!t.isActive && " · идэвхгүй"}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-5">
            <Card title={isNew ? "Шинэ төрөл" : `${current?.name ?? ""} · ерөнхий тохиргоо`}>
              <form action={saveType} className="grid gap-4 md:grid-cols-3">
                <input type="hidden" name="id" value={current?.id ?? ""} />
                <div><label className="label">Төрлийн нэр</label><input name="name" defaultValue={current?.name} required className="input" /></div>
                <div><label className="label">Код</label><input name="code" defaultValue={current?.code} required className="input font-mono" /></div>
                <div>
                  <label className="label">Ангилал</label>
                  <select name="categoryId" defaultValue={current?.categoryId} className="input">
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Дугаарлалтын дүрэм</label>
                  <select name="numberingRuleId" defaultValue={current?.numberingRuleId ?? ""} className="input">
                    <option value="">— Дугааргүй —</option>
                    {rules.map((r) => <option key={r.id} value={r.id}>{r.pattern} {r.resetPeriod === "YEARLY" ? "· жил бүр" : ""}</option>)}
                  </select>
                </div>
                <div><label className="label">Хадгалах хугацаа (жил)</label><input name="retention" type="number" min={0} defaultValue={current?.defaultRetentionYears ?? ""} className="input" /></div>
                <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" name="isActive" defaultChecked={current?.isActive ?? true} className="h-4 w-4" /> Идэвхтэй</label>
                <div className="md:col-span-3"><SubmitButton pendingText="Хадгалж байна…">Хадгалах</SubmitButton></div>
              </form>
            </Card>

            {current && (
              <Card title="Маягтын талбар" right={<span className="text-xs text-slate-500">{current.fields.length} талбар · сумаар дараалал өөрчилнө</span>}>
                <p className="-mt-2 mb-3 text-xs text-slate-500">Гарчиг, баримтын огноо, хавсралт зэрэг бүх төрөлд нийтлэг талбар автоматаар нэмэгдэнэ.</p>
                <table className="w-full">
                  <thead className="border-b border-slate-100"><tr><th className="th px-1">№</th><th className="th">Талбарын нэр</th><th className="th">Код</th><th className="th">Өгөгдлийн төрөл</th><th className="th">Заавал эсэх</th><th className="th">Төлөв</th><th className="th"></th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {current.fields.map((f, i) => (
                      <tr key={f.id} className={f.isActive ? "" : "text-slate-400"}>
                        <td className="px-1 py-3 text-sm">
                          <span className="flex items-center gap-1">
                            {i + 1}
                            <form action={moveField}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="dir" value="up" /><button className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Дээш" aria-label={`«${f.label}» дээш`}><ArrowUp size={14} /></button></form>
                            <form action={moveField}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="dir" value="down" /><button className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Доош" aria-label={`«${f.label}» доош`}><ArrowDown size={14} /></button></form>
                          </span>
                        </td>
                        <td className="td font-medium">{f.label}</td>
                        <td className="td font-mono text-xs text-slate-600">{f.name}</td>
                        <td className="td">{DATA_TYPE_LABELS[f.dataType] ?? f.dataType} {f.dataType === "employee" && <Pill tone="navy">Хүний нөөц</Pill>}</td>
                        <td className="td">{f.isRequired ? <span className="font-semibold text-green-700">✓ Заавал</span> : "Сонголттой"}</td>
                        <td className="td">{f.isActive ? "Идэвхтэй" : "Идэвхгүй"}</td>
                        <td className="td">
                          <ModalButton label="Засах" title={`«${f.label}» талбар засах`} className="font-semibold link">
                            <FieldForm typeId={current.id} f={f} />
                            <div className="mt-4 border-t border-slate-100 pt-4">
                                <ConfirmButton
                                  action={deleteField}
                                  fields={{ id: f.id }}
                                  className="text-xs font-semibold text-red-700 hover:underline"
                                  title={`«${f.label}» талбарыг устгах уу?`}
                                  description="Энэ талбарт утга бүртгэгдсэн баримт байвал талбар устахгүй, идэвхгүй болж түүх нь хадгалагдана. Утгагүй бол бүрмөсөн устах бөгөөд буцаах боломжгүй."
                                  confirmLabel="Устгах"
                                >
                                  Устгах
                                </ConfirmButton>
                            </div>
                          </ModalButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4">
                  <ModalButton label="+ Талбар нэмэх" title={`«${current.name}» төрөлд талбар нэмэх`} className="btn-outline">
                    <FieldForm typeId={current.id} />
                  </ModalButton>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "categories" && (
        <Card title="Баримтын ангилал">
          <div className="hidden grid-cols-[160px_1fr_110px_90px_110px] gap-3 border-b border-slate-100 pb-2 text-xs font-semibold text-slate-500 md:grid">
            <span>Код</span><span>Нэр</span><span>Төрлийн тоо</span><span>Идэвхтэй</span><span />
          </div>
          <ul className="divide-y divide-slate-100">
            {cats.map((c) => (
              <li key={c.id} className="py-3">
                <form action={saveCategory} className="grid items-center gap-3 md:grid-cols-[160px_1fr_110px_90px_110px]">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="code" defaultValue={c.code} aria-label="Ангиллын код" className="input font-mono" />
                  <input name="name" defaultValue={c.name} aria-label="Ангиллын нэр" className="input" />
                  <span className="text-sm text-slate-600"><span className="md:hidden">Төрөл: </span>{c.types.length}</span>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c.isActive} className="h-4 w-4" /><span className="md:sr-only">Идэвхтэй</span></label>
                  <SubmitButton className="btn-outline py-1.5" pendingText="…">Хадгалах</SubmitButton>
                </form>
              </li>
            ))}
            <li className="py-3">
              <form action={saveCategory} className="grid items-center gap-3 md:grid-cols-[160px_1fr_110px_90px_110px]">
                <input name="code" placeholder="Шинэ код" aria-label="Шинэ ангиллын код" required className="input font-mono" />
                <input name="name" placeholder="Шинэ ангиллын нэр" aria-label="Шинэ ангиллын нэр" required className="input" />
                <span className="hidden md:block" /><span className="hidden md:block" />
                <SubmitButton className="btn-primary py-1.5" pendingText="…">Нэмэх</SubmitButton>
              </form>
            </li>
          </ul>
        </Card>
      )}

      {tab === "numbering" && (
        <Card title="Дугаарлалтын дүрэм">
          <p className="-mt-2 mb-4 text-sm text-slate-500">Хэлбэрт ашиглах тэмдэг: <code>{"{SEQ:3}"}</code> дараалал (3 оронтой), <code>{"{YYYY}"}</code> он, <code>{"{TYPE}"}</code> төрлийн код, <code>{"{DEPT}"}</code> нэгжийн код. Тоологч транзакц дотор түгжигдэж олгогддог тул дугаар давхардахгүй.</p>
          <div className="hidden grid-cols-[200px_140px_90px_130px_1fr_110px] gap-3 border-b border-slate-100 pb-2 text-xs font-semibold text-slate-500 lg:grid">
            <span>Хэлбэр</span><span>Тэглэх</span><span>Нэгжээр</span><span>Жишээ</span><span>Ашиглаж буй төрөл</span><span />
          </div>
          <ul className="divide-y divide-slate-100">
            {[...rules, null].map((r) => (
              <li key={r?.id ?? "new"} className="py-3">
                <form action={saveRule} className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[200px_140px_90px_130px_1fr_110px]">
                  <input type="hidden" name="id" value={r?.id ?? ""} />
                  <input name="pattern" defaultValue={r?.pattern} placeholder="Ж/{YY}-{SEQ:3}" aria-label="Дугаарын хэлбэр" required className="input font-mono" />
                  <select name="resetPeriod" defaultValue={r?.resetPeriod ?? "YEARLY"} aria-label="Тоологч тэглэх" className="input"><option value="YEARLY">Жил бүр</option><option value="NEVER">Хэзээ ч</option></select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="perDepartment" defaultChecked={r?.perDepartment} className="h-4 w-4" /><span className="lg:sr-only">Нэгж бүрээр тусдаа</span></label>
                  <span className="font-mono text-sm">{r ? formatNumber(r.pattern, { typeCode: "A", deptCode: "ADM", year: new Date().getFullYear(), seq: 7 }) : <span className="font-sans text-slate-400">Шинэ дүрэм</span>}</span>
                  <span className="truncate text-sm text-slate-600" title={r?.types.map((t) => t.name).join(", ")}>{r?.types.map((t) => t.name).join(", ")}</span>
                  <SubmitButton className={r ? "btn-outline py-1.5" : "btn-primary py-1.5"} pendingText="…">{r ? "Хадгалах" : "Нэмэх"}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "transitions" && <Transitions />}
      {tab === "routing" && <Routing types={allTypes.map((t) => ({ id: t.id, name: t.name }))} />}
    </div>
  );
}

function FieldForm({ typeId, f }: { typeId: string; f?: { id: string; label: string; name: string; dataType: string; isRequired: boolean; isActive: boolean; options: unknown } }) {
  const p = `ff-${f?.id ?? "new"}`;
  return (
    <form action={saveField} className="space-y-4 text-sm">
      <ModalCloser />
      <input type="hidden" name="id" value={f?.id ?? ""} />
      <input type="hidden" name="documentTypeId" value={typeId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor={`${p}-label`}>Талбарын нэр <span className="text-red-600">*</span></label><input id={`${p}-label`} name="label" defaultValue={f?.label} required className="input" /></div>
        <div><label className="label" htmlFor={`${p}-name`}>Код (латин) <span className="text-red-600">*</span></label><input id={`${p}-name`} name="name" defaultValue={f?.name} required className="input font-mono" /></div>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-type`}>Өгөгдлийн төрөл</label>
        <select id={`${p}-type`} name="dataType" defaultValue={f?.dataType ?? "text"} className="input">
          {Object.entries(DATA_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-opts`}>Сонголтууд</label>
        <input id={`${p}-opts`} name="options" defaultValue={Array.isArray(f?.options) ? (f!.options as string[]).join(", ") : ""} aria-describedby={`${p}-opts-help`} className="input" />
        <p id={`${p}-opts-help`} className="mt-1 text-xs text-slate-500">«Сонголт» төрөлд л хэрэглэнэ. Таслалаар тусгаарлана: Б, А, Ш</p>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2"><input type="checkbox" name="isRequired" defaultChecked={f?.isRequired} className="h-4 w-4" /> Заавал бөглөх</label>
        {f && <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={f.isActive} className="h-4 w-4" /> Идэвхтэй</label>}
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Хадгалж байна…">{f ? "Хадгалах" : "Талбар нэмэх"}</SubmitButton>
    </form>
  );
}

async function Transitions() {
  const list = await prisma.statusTransition.findMany({ include: { fromStatus: true, toStatus: true, permission: true, documentType: true }, orderBy: [{ fromStatus: { displayOrder: "asc" } }] });
  return (
    <Card title="Төлөвийн шилжилт" right={<span className="text-xs text-slate-500">status_transitions хүснэгтээс</span>}>
      <table className="w-full">
        <thead className="border-b border-slate-100"><tr><th className="th px-0">Эхлэх төлөв</th><th className="th">Үйлдэл</th><th className="th">Очих төлөв</th><th className="th">Шаардлагатай эрх</th><th className="th">Төрөл</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((t) => (
            <tr key={t.id}>
              <td className="py-2.5 text-sm">{t.fromStatus.name}</td>
              <td className="td font-medium">{ACTION_LABELS[t.actionCode] ?? t.actionCode}</td>
              <td className="td">{t.toStatus.name}</td>
              <td className="td font-mono text-xs">{t.permission.code}</td>
              <td className="td text-slate-500">{t.documentType?.name ?? "Бүх төрөл"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type RuleRow = {
  id?: string; name?: string; documentTypeId?: string | null; confidentiality?: string | null; direction?: string | null;
  departmentId?: string | null; fieldId?: string | null; fieldValue?: string | null; reviewerId?: string; priority?: number; isActive?: boolean;
};
type Opt = { id: string; name: string };

/** Мета өгөгдлөөр автоматаар чиглүүлэх дүрмүүд */
async function Routing({ types }: { types: Opt[] }) {
  const [rules, departments, fields, reviewers] = await Promise.all([
    prisma.routingRule.findMany({ orderBy: [{ isActive: "desc" }, { priority: "asc" }], include: { documentType: true, department: true, field: true, reviewer: { include: { employee: true } } } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.fieldDefinition.findMany({ where: { isActive: true, dataType: { in: ["select", "text", "department", "number"] } }, include: { documentType: true }, orderBy: [{ documentType: { name: "asc" } }, { displayOrder: "asc" }] }),
    prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { permissions: { some: { permission: { code: "document.approve" } } } } } } },
      include: { employee: { include: { department: true } } },
      orderBy: { employee: { lastName: "asc" } },
    }),
  ]);
  const opts = {
    types,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    fields: fields.map((f) => ({ id: f.id, name: `${f.documentType.name} › ${f.label}` })),
    reviewers: reviewers.map((r) => ({ id: r.id, name: `${shortName(r.employee)} — ${r.employee.positionName ?? r.employee.department.name}` })),
  };
  const cond = (r: (typeof rules)[number]) =>
    [
      r.documentType && `Төрөл = ${r.documentType.name}`,
      r.confidentiality && `Нууцлал = ${CONF_LABELS[r.confidentiality] ?? r.confidentiality}`,
      r.direction && `Чиглэл = ${DIRECTION_LABELS[r.direction] ?? r.direction}`,
      r.department && `Нэгж = ${r.department.name}`,
      r.field && `${r.field.label} = ${r.fieldValue ?? "(бөглөсөн)"}`,
    ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4 text-sm leading-relaxed text-slate-700">
        Баримтыг хяналтад илгээх үед систем доорх дүрмүүдийг <b>эрэмбийн</b> дарааллаар шалгаж, нөхцөл бүрэн таарсан эхний дүрмийн хянагчид автоматаар илгээнэ.
        Хоосон нөхцөл нь «ямар ч» гэсэн утгатай. Тохирох дүрэм байхгүй, эсвэл хянагч нь баримт үүсгэгч өөрөө бол (БД-05) хэрэглэгч хянагчийг гараар сонгоно.
      </div>
      <Card title="Чиглүүлэх дүрмүүд" right={<span className="text-xs text-slate-500">{rules.filter((r) => r.isActive).length} идэвхтэй дүрэм</span>}>
        {rules.length === 0 && <p className="text-sm text-slate-500">Дүрэм бүртгэгдээгүй байна.</p>}
        <ul className="divide-y divide-slate-100">
          {rules.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${r.isActive ? "" : "opacity-50"}`}>
              <span className="w-10 shrink-0 rounded-md bg-slate-100 py-1 text-center font-mono text-xs font-semibold text-slate-600" title="Эрэмбэ">{r.priority}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{r.name} {!r.isActive && <Pill>идэвхгүй</Pill>}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {cond(r).map((c) => <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{c}</span>)}
                  <span className="text-xs text-slate-400">→</span>
                  <span className="rounded-md bg-navy-800 px-2 py-0.5 text-xs font-semibold text-white">{shortName(r.reviewer.employee)}</span>
                </div>
              </div>
              <ModalButton label="Засах" title={`«${r.name}» дүрэм засах`} size="lg" className="text-sm font-semibold link">
                  <RuleForm r={r} {...opts} />
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <ConfirmButton
                      action={deleteRoutingRule}
                      fields={{ id: r.id }}
                      className="text-xs font-semibold text-red-700 hover:underline"
                      title={`«${r.name}» дүрмийг устгах уу?`}
                      description="Устгасны дараа энэ нөхцөлтэй баримтууд дараагийн тохирох дүрмээр, эсвэл гараар сонгосон хянагч руу очно. Буцаах боломжгүй — түр зогсоох бол «Идэвхтэй»-г болиулна уу."
                      confirmLabel="Дүрмийг устгах"
                    >
                      Дүрмийг устгах
                    </ConfirmButton>
                  </div>
              </ModalButton>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Шинэ дүрэм нэмэх">
        <RuleForm {...opts} />
      </Card>
    </div>
  );
}

function RuleForm({ r, types, departments, fields, reviewers }: { r?: RuleRow; types: Opt[]; departments: Opt[]; fields: Opt[]; reviewers: Opt[] }) {
  const any = <option value="">— Ямар ч —</option>;
  const p = `rf-${r?.id ?? "new"}`;
  return (
    <form action={saveRoutingRule} className="grid gap-3 text-sm md:grid-cols-3">
      <ModalCloser />
      <input type="hidden" name="id" value={r?.id ?? ""} />
      <div className="md:col-span-2"><label className="label" htmlFor={`${p}-name`}>Дүрмийн нэр <span className="text-red-600">*</span></label><input id={`${p}-name`} name="name" required defaultValue={r?.name} placeholder="Жишээ: Нууц баримт захирал руу" className="input" /></div>
      <div><label className="label" htmlFor={`${p}-priority`}>Эрэмбэ (бага нь түрүүлнэ)</label><input id={`${p}-priority`} name="priority" type="number" min={1} max={999} defaultValue={r?.priority ?? 100} className="input" /></div>
      <div>
        <label className="label" htmlFor={`${p}-documentTypeId`}>Баримтын төрөл</label>
        <select id={`${p}-documentTypeId`} name="documentTypeId" defaultValue={r?.documentTypeId ?? ""} className="input">{any}{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-confidentiality`}>Нууцлалын түвшин</label>
        <select id={`${p}-confidentiality`} name="confidentiality" defaultValue={r?.confidentiality ?? ""} className="input">{any}{Object.entries(CONF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-direction`}>Чиглэл</label>
        <select id={`${p}-direction`} name="direction" defaultValue={r?.direction ?? ""} className="input">{any}<option value="INTERNAL">{DIRECTION_LABELS.INTERNAL}</option><option value="OUTGOING">{DIRECTION_LABELS.OUTGOING}</option></select>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-departmentId`}>Эзэмшигч нэгж</label>
        <select id={`${p}-departmentId`} name="departmentId" defaultValue={r?.departmentId ?? ""} className="input">{any}{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-fieldId`}>Талбар</label>
        <select id={`${p}-fieldId`} name="fieldId" defaultValue={r?.fieldId ?? ""} className="input">{any}{fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </div>
      <div><label className="label" htmlFor={`${p}-fieldValue`}>Талбарын утга</label><input id={`${p}-fieldValue`} name="fieldValue" defaultValue={r?.fieldValue ?? ""} placeholder="Жишээ: Б" className="input" /></div>
      <div className="md:col-span-2">
        <label className="label" htmlFor={`${p}-reviewerId`}>Хянагч (автоматаар илгээх) <span className="text-red-600">*</span></label>
        <select id={`${p}-reviewerId`} name="reviewerId" required defaultValue={r?.reviewerId ?? ""} className="input"><option value="" disabled>— Сонгох —</option>{reviewers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      </div>
      {r && <label className="flex items-center gap-2 pt-7"><input type="checkbox" name="isActive" defaultChecked={r.isActive} className="h-4 w-4" /> Идэвхтэй</label>}
      <div className="md:col-span-3"><SubmitButton pendingText="Хадгалж байна…">{r ? "Хадгалах" : "Дүрэм нэмэх"}</SubmitButton></div>
    </form>
  );
}
