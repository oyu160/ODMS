"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload, File as FileIcon, X, Info, Route, Undo2 } from "lucide-react";
import { pickRule, type RuleLike } from "@/lib/routing";
import { RELATION_TYPES } from "@/lib/format";
import { saveDocument, type SaveState } from "./save-action";
import { Toast, Spinner } from "@/components/feedback";

export type FormField = { id: string; label: string; dataType: string; isRequired: boolean; options: string[] };
export type FormType = { id: string; code: string; name: string; category: string; pattern: string | null; fields: FormField[] };
export type Initial = {
  documentId?: string;
  internalNumber?: string;
  statusName?: string;
  title?: string;
  summary?: string;
  direction?: string;
  confidentiality?: string;
  documentDate?: string;
  values?: Record<string, string>;
  attachments?: { id: string; name: string; size: string; isMain?: boolean; locked?: boolean }[];
  returnedComment?: string | null;
};

type Props = {
  type: FormType;
  employees: { id: string; name: string; dept: string; code: string }[];
  departments: { id: string; name: string }[];
  reviewers: { id: string; name: string; sub: string; initials: string }[];
  related: { id: string; label: string }[];
  rules?: RuleLike[];
  me?: { id: string; departmentId: string };
  initial: Initial;
};

export function DocumentForm({ type, employees, departments, reviewers, related, rules = [], me, initial }: Props) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDocument, undefined);
  const [files, setFiles] = useState<File[]>([]);
  // Сервэрээс ирсэн талбар бүрийн алдаа. Хэрэглэгч тухайн талбарыг засмагц алдаа нь арилна.
  const [fixed, setFixed] = useState<string[]>([]);
  const fieldErrors = state?.fieldErrors ?? {};
  const errOf = (name: string) => (fixed.includes(name) ? undefined : fieldErrors[name]);
  const markFixed = (name: string) => setFixed((p) => (p.includes(name) ? p : [...p, name]));
  useEffect(() => {
    setFixed([]);
    if (state?.fieldErrors && Object.keys(state.fieldErrors).length) {
      // Эхний алдаатай талбар руу шилжиж, фокуслана
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }
  }, [state]);
  /** Алдаатай талбарт өгөх a11y шинж ба улаан хүрээ */
  const invalid = (name: string) => {
    const e = errOf(name);
    return {
      id: `doc-${name}`,
      "aria-invalid": e ? (true as const) : undefined,
      "aria-describedby": e ? `doc-${name}-err` : undefined,
      className: e ? "input border-red-500 bg-red-50/40 focus:ring-red-200" : "input",
    };
  };
  const FieldError = ({ name }: { name: string }) => {
    const e = errOf(name);
    return e ? <p id={`doc-${name}-err`} className="mt-1 text-xs font-medium text-red-600">{e}</p> : null;
  };
  // Хадгалсан хавсралтаас хасахаар тэмдэглэсэн файлууд (хадгалах үед устгагдана)
  const [removed, setRemoved] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>(initial.values ?? {});
  const [direction, setDirection] = useState(initial.direction ?? "INTERNAL");
  const [confidentiality, setConfidentiality] = useState(initial.confidentiality ?? "INTERNAL");
  // Мета өгөгдлийн дүрэм: төрөл, нууцлал, чиглэл, талбарын утгаас хянагчийг автоматаар тодорхойлно
  const route = useMemo(
    () =>
      me
        ? pickRule(rules, {
            documentTypeId: type.id,
            confidentiality,
            direction,
            ownerDepartmentId: me.departmentId,
            createdById: me.id,
            fields: Object.entries(values).map(([fieldId, valueText]) => ({ fieldId, valueText })),
          })
        : null,
    [rules, me, type.id, confidentiality, direction, values],
  );
  const autoReviewer = route ? reviewers.find((r) => r.id === route.reviewerId) : undefined;
  const [reviewerId, setReviewerId] = useState(rules.length ? "" : reviewers[0]?.id ?? "");
  const reviewer = reviewerId ? reviewers.find((r) => r.id === reviewerId) : autoReviewer;
  const incoming = direction === "INCOMING";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  // FormData-д файлуудыг гараар нэмнэ (жагсаалтаас устгах боломжтой)
  const submit = (fd: FormData) => {
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    fd.delete("removeAttachment");
    removed.forEach((id) => fd.append("removeAttachment", id));
    return action(fd);
  };

  const fieldInput = (f: FormField) => {
    const name = `f_${f.id}`;
    const val = values[f.id] ?? "";
    const set = (v: string) => {
      setValues((p) => ({ ...p, [f.id]: v }));
      markFixed(name);
    };
    const a = invalid(name);
    if (f.dataType === "select")
      return (
        <select name={name} value={val} onChange={(e) => set(e.target.value)} {...a}>
          <option value="">Сонгоно уу</option>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    if (f.dataType === "employee") {
      const emp = employees.find((e) => e.id === val);
      return (
        <div className="space-y-1">
          <select name={name} value={val} onChange={(e) => set(e.target.value)} {...a}>
            <option value="">Ажилтан сонгох</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.code}</option>)}
          </select>
          {emp && <p className="text-xs text-slate-500">Хэлтэс: {emp.dept} <span className="ml-1 rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy-800">Хүний нөөц</span></p>}
        </div>
      );
    }
    if (f.dataType === "department")
      return (
        <select name={name} value={val} onChange={(e) => set(e.target.value)} {...a}>
          <option value="">Нэгж сонгох</option>
          {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      );
    if (f.dataType === "textarea") return <textarea name={name} rows={3} value={val} onChange={(e) => set(e.target.value)} {...a} />;
    return <input name={name} value={val} onChange={(e) => set(e.target.value)} type={f.dataType === "number" ? "number" : f.dataType === "date" ? "date" : "text"} {...a} />;
  };

  return (
    <form action={submit}>
      <input type="hidden" name="documentTypeId" value={type.id} />
      {initial.documentId && <input type="hidden" name="documentId" value={initial.documentId} />}

      <div className="card mb-5 flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
        <span className="font-medium text-slate-700">Баримтын төрөл:</span>
        <span className="rounded-md bg-navy-800 px-2.5 py-1 text-xs font-semibold text-white">{type.name}</span>
        <span className="text-slate-500">Ангилал: {type.category} · Маягтын талбаруудыг төрлийн тохиргооноос үүсгэв</span>
        {!initial.documentId && <Link href="/documents/new" className="ml-auto font-semibold text-slate-800 hover:underline">Төрөл солих</Link>}
      </div>

      {initial.returnedComment && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm text-orange-900">
          <b>Засварт буцаасан шалтгаан:</b> {initial.returnedComment}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold">Ерөнхий мэдээлэл</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label" htmlFor="doc-title">Гарчиг <span className="text-red-600">*</span></label>
                <input name="title" defaultValue={initial.title} required maxLength={255} {...invalid("title")} onChange={() => markFixed("title")} />
                <FieldError name="title" />
              </div>
              <div>
                <label className="label">Албан ёсны дугаар</label>
                <input disabled value={incoming ? "Бүртгэх үед автоматаар олгоно" : "Батлагдсаны дараа автоматаар олгоно"} className="input" />
                {type.pattern && <p className="mt-1 text-xs text-slate-500">Дугаарлалтын дүрэм: {type.pattern}</p>}
              </div>
              <div>
                <label className="label" htmlFor="doc-documentDate">Баримтын огноо <span className="text-red-600">*</span></label>
                <input type="date" name="documentDate" defaultValue={initial.documentDate ?? today} required {...invalid("documentDate")} onChange={() => markFixed("documentDate")} />
                <FieldError name="documentDate" />
              </div>
              <div>
                <label className="label">Чиглэл</label>
                <select name="direction" value={direction} onChange={(e) => setDirection(e.target.value)} className="input">
                  <option value="INTERNAL">Дотоод</option>
                  <option value="OUTGOING">Явсан</option>
                  <option value="INCOMING">Ирсэн</option>
                </select>
              </div>
              <div>
                <label className="label">Нууцлалын түвшин <span className="text-red-600">*</span></label>
                <select name="confidentiality" value={confidentiality} onChange={(e) => setConfidentiality(e.target.value)} className="input">
                  <option value="NORMAL">Энгийн</option>
                  <option value="INTERNAL">Дотоод</option>
                  <option value="CONFIDENTIAL">Нууц</option>
                </select>
              </div>
              <div className="grid gap-4 md:col-span-2 md:grid-cols-[200px_1fr]">
                <div>
                  <label className="label" htmlFor="doc-reltype">Хамаарал</label>
                  <select id="doc-reltype" name="relationType" defaultValue={incoming ? "Хариу" : "Үндэслэсэн"} className="input">
                    {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="doc-related">Холбоотой баримт</label>
                  <select id="doc-related" name="relatedId" defaultValue="" className="input" aria-describedby="doc-related-help">
                    <option value="">— Сонгоогүй —</option>
                    {related.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <p id="doc-related-help" className="mt-1 text-xs text-slate-500">Жишээ: ирсэн бичгийн хариуг «Хариу», батлагдсан баримтыг өөрчилж буй бол «Өөрчилсөн»</p>
                </div>
              </div>
            </div>
          </section>

          {type.fields.length > 0 && (
            <section className="card p-5">
              <h2 className="text-base font-semibold">«{type.name}» төрлийн мэдээлэл</h2>
              <p className="mb-4 text-xs text-slate-500">Энэ хэсгийн талбарууд сонгосон төрлөөс хамаарч өөрчлөгдөнө.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {type.fields.map((f) => (
                  <div key={f.id} className={f.dataType === "textarea" ? "md:col-span-2" : ""}>
                    <label className="label" htmlFor={`doc-f_${f.id}`}>{f.label} {f.isRequired && <span className="text-red-600">*</span>}</label>
                    {fieldInput(f)}
                    <FieldError name={`f_${f.id}`} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card p-5">
            <label className="label" htmlFor="doc-summary">Агуулга / товч утга</label>
            <textarea id="doc-summary" name="summary" rows={5} defaultValue={initial.summary} className="input" placeholder="Баримтын товч агуулга…" />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Хавсралт</h2>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-navy-600 hover:bg-navy-50/40 focus-within:border-navy-600 focus-within:ring-2 focus-within:ring-navy-100">
              <Upload size={20} className="text-slate-600" />
              <span className="text-sm"><b>Файл сонгох</b> эсвэл энд дарна уу</span>
              <span className="text-xs text-slate-500">PDF, DOCX, XLSX, JPG, PNG · нэг файл 20 МБ хүртэл</span>
              <input type="file" multiple className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => addFiles(e.target.files)} />
            </label>
            <ul className="mt-3 space-y-2">
              {initial.attachments?.map((a) => {
                const gone = removed.includes(a.id);
                return (
                  <li key={a.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${gone ? "border-dashed border-red-200 bg-red-50/50" : "border-slate-200"}`}>
                    <FileIcon size={16} className={gone ? "text-red-400" : "text-slate-500"} aria-hidden />
                    <span className={`min-w-0 flex-1 truncate ${gone ? "text-slate-500 line-through" : ""}`}>{a.name}</span>
                    {a.isMain && !gone && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">үндсэн</span>}
                    <span className="text-xs text-slate-500">{gone ? "Хасагдана" : a.size}</span>
                    {a.locked ? (
                      <span className="text-xs text-slate-400" title="Цахим гарын үсэгтэй файлыг хасах боломжгүй">түгжээтэй</span>
                    ) : gone ? (
                      <button type="button" onClick={() => setRemoved((p) => p.filter((x) => x !== a.id))} aria-label={`«${a.name}»-г буцааж үлдээх`} title="Буцаах" className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900"><Undo2 size={14} /></button>
                    ) : (
                      <button type="button" onClick={() => setRemoved((p) => [...p, a.id])} aria-label={`«${a.name}» файлыг хасах`} title="Хасах" className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"><X size={14} /></button>
                    )}
                  </li>
                );
              })}
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <FileIcon size={16} className="text-slate-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-800">шинэ</span>
                  <span className="text-xs text-slate-500">{Math.max(1, Math.round(f.size / 1024))} КБ</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label={`«${f.name}» файлыг хасах`} title="Хасах" className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"><X size={14} /></button>
                </li>
              ))}
            </ul>
            {removed.length > 0 && (
              <p className="mt-2 text-xs text-red-700" role="status">{removed.length} файл хадгалах үед хасагдана. Буцаах бол ↶ товч дарна уу.</p>
            )}
          </section>

          {!incoming && (
            <section className="card p-5">
              <h2 className="text-base font-semibold">Хянагч</h2>
              <p className="mb-3 text-xs text-slate-500">Мета өгөгдлийн дүрмээр автоматаар сонгогдоно, эсвэл батлах эрхтэй удирдлагаас гараар сонгоно</p>
              <select name="reviewerId" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="input">
                <option value="">{autoReviewer ? `Автоматаар — ${autoReviewer.name}` : "— Сонгох —"}</option>
                {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {!reviewerId && (
                <p className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs ${route ? "bg-navy-50 text-navy-900" : "bg-amber-50 text-amber-900"}`}>
                  <Route size={14} className="mt-0.5 shrink-0" />
                  {route ? <span>Дүрэм: <b>{route.name}</b></span> : <span>Тохирох чиглүүлэх дүрэм алга. Хянагчийг гараар сонгоно уу.</span>}
                </p>
              )}
              {reviewer && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-sm font-semibold text-white">{reviewer.initials}</span>
                  <span><span className="block text-sm font-semibold">{reviewer.name}</span><span className="text-xs text-slate-500">{reviewer.sub}</span></span>
                </div>
              )}
            </section>
          )}

          <div className="flex gap-2 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600">
            <Info size={16} className="shrink-0" />
            {incoming
              ? "Ирсэн бичгийг бүртгэхэд албан ёсны дугаар (И/…) автоматаар олгогдож, дараа нь хариуцагчид хуваарилна."
              : "Хяналтад илгээсний дараа баримтыг засах боломжгүй. Хянагч засварт буцаавал дахин засна."}
          </div>
        </aside>
      </div>

      {state?.error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button name="intent" value="draft" disabled={pending} className="btn-outline px-5 py-2.5">Ноорог хадгалах</button>
        {incoming ? (
          <button name="intent" value="register" disabled={pending} className="btn-primary px-5 py-2.5">Бүртгэх</button>
        ) : (
          <button name="intent" value="submit" disabled={pending} className="btn-primary px-5 py-2.5">Хяналтад илгээх</button>
        )}
        <span className="text-xs text-slate-500"><span className="text-red-600">*</span> Заавал бөглөх талбар бүрэн бол хяналтад илгээнэ</span>
        {pending && <span className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Хадгалж байна, файл байршуулж байна…</span>}
        <Toast message={state?.error} tone="error" />
      </div>
    </form>
  );
}
