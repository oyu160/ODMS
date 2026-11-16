"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { reviewerEdit, type ActionState } from "./actions";
import { Toast, Spinner } from "@/components/feedback";

export type EditField = { id: string; label: string; dataType: string; value: string; options: string[] };

/** Хянагч баримтыг үүсгэгч рүү буцаалгүйгээр жижиг засвар оруулах хэсэг */
export function ReviewerEdit({ documentId, title, summary, fields }: { documentId: string; title: string; summary: string; fields: EditField[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewerEdit, undefined);
  const [open, setOpen] = useState(false);
  const [approveAfter, setApproveAfter] = useState(true);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open)
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setOpen(true)} className="btn-outline w-full py-2.5">
          <Pencil size={15} /> Жижиг засвар оруулах
        </button>
        <p className="text-xs text-slate-500">Үг үсэг, огноо зэрэг жижиг алдааг буцаалгүйгээр өөрөө засна. Засвар шинэ хувилбар болж хадгалагдана.</p>
        {state?.ok && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>}
        <Toast message={state?.ok} />
      </div>
    );

  return (
    <form action={action} className="space-y-3 rounded-xl border border-navy-200 bg-navy-50/40 p-4">
      <input type="hidden" name="documentId" value={documentId} />
      <div className="text-sm font-semibold">Хянагчийн засвар</div>
      <div>
        <label className="label">Гарчиг</label>
        <input name="title" defaultValue={title} className="input" />
      </div>
      {fields
        .filter((f) => f.dataType !== "employee")
        .map((f) => (
          <div key={f.id}>
            <label className="label">{f.label}</label>
            {f.dataType === "select" ? (
              <select name={`f_${f.id}`} defaultValue={f.value} className="input">
                <option value="">—</option>
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : f.dataType === "textarea" ? (
              <textarea name={`f_${f.id}`} defaultValue={f.value} rows={2} className="input" />
            ) : (
              <input name={`f_${f.id}`} defaultValue={f.value} type={f.dataType === "date" ? "date" : f.dataType === "number" ? "number" : "text"} className="input" />
            )}
          </div>
        ))}
      <div>
        <label className="label">Агуулга</label>
        <textarea name="summary" defaultValue={summary} rows={4} className="input" />
      </div>
      <div>
        <label className="label">Юу зассан бэ? *</label>
        <input name="editNote" required placeholder="Жишээ: огноог засав, үг үсгийн алдаа" className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approveAfter" checked={approveAfter} onChange={(e) => setApproveAfter(e.target.checked)} className="h-4 w-4" /> Засварын дараа шууд батлах
      </label>
      {approveAfter && (
        <div>
          <label className="label">Цахим гарын үсгийн нууц үг *</label>
          <input type="password" name="password" required autoComplete="current-password" className="input" placeholder="Нэвтрэх нууц үг" />
        </div>
      )}
      <div className="flex gap-2">
        <button disabled={pending} className="btn-primary flex-1">{pending ? <><Spinner /> Хадгалж байна…</> : "Засвар хадгалах"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline">Болих</button>
      </div>
      {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <p className="text-xs text-slate-500">Үүсгэгчид мэдэгдэл очиж, засвар «Хувилбарын түүх», аудитад үлдэнэ.</p>
    </form>
  );
}
