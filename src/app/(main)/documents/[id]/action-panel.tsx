"use client";

// Үйлдлийн товчнууд: товч дарахад тухайн үйлдлийн цонх (modal) нээгдэж,
// шаардлагатай мэдээллээ бөглөөд «Баталгаажуулах» дарна.
import { useActionState, useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { runAction, type ActionState } from "./actions";
import { Toast, Spinner } from "@/components/feedback";

export type Option = { id: string; name: string };
type Props = {
  documentId: string;
  actions: { code: string; label: string }[];
  reviewers?: Option[];
  users?: Option[];
  departments?: Option[];
  defaultArchiveCategory?: string;
  compact?: boolean;
  /** Мета өгөгдлийн дүрмээр автоматаар сонгогдох хянагч (байвал «Автоматаар» сонголт харагдана) */
  autoReviewer?: { name: string; rule: string } | null;
};

const PRIMARY = ["approve", "submit", "resubmit", "register", "register_incoming", "assign", "resolve", "archive"];
const DANGER = new Set(["cancel"]);
const COMMENT_REQUIRED = new Set(["return", "resolve", "cancel"]);
const HINT: Record<string, string> = {
  submit: "Баримт хянагч руу илгээгдэж, та засах боломжгүй болно. Хянагч засварт буцаавал дахин засна.",
  resubmit: "Зассан баримтыг хянагч руу дахин илгээнэ.",
  approve: "Батлахад систем албан ёсны дугаар олгож, таны цахим гарын үсгээр баталгаажуулна. Нууц үгээ дахин оруулна уу.",
  return: "Баримт үүсгэгч рүү буцаж, тэр засаад дахин илгээнэ. Шалтгааныг тодорхой бичнэ үү.",
  register: "Батлагдсан баримтыг бүртгэлд авна. Дараа нь хариуцагчид хуваарилах эсвэл архивлана.",
  register_incoming: "Ирсэн бичгийг бүртгэж, И/… дугаар олгоно.",
  assign: "Нэг ажилтан эсвэл нэг нэгжид хугацаатай хуваарилна (БД-09).",
  reassign: "Хариуцагч шилжсэн, ажлаас гарсан үед шинэ хариуцагч томилно (БД-11).",
  resolve: "Шийдвэрлэсэн үр дүнгээ бичнэ. Хуваарилсан хүнд мэдэгдэл очно.",
  archive: "Баримтыг архивт шилжүүлж, хадгалах хугацааг автоматаар тооцно.",
  cancel: "Цуцалсан баримтыг сэргээх боломжгүй. Шалтгааныг заавал бичнэ (БД-04).",
  forward: "Олон шатлалт хяналт: таны шат хаагдаж, сонгосон хянагчид баримт очно. Тэр батлах, буцаах эсвэл дахин шилжүүлнэ.",
};

export function ActionPanel({ documentId, actions, reviewers = [], users = [], departments = [], defaultArchiveCategory, autoReviewer }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(runAction, undefined);
  const [open, setOpen] = useState<{ code: string; label: string } | null>(null);

  // Амжилттай болмогц цонхыг хаана
  useEffect(() => {
    if (state?.ok) setOpen(null);
  }, [state]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending]);

  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const sorted = [...actions].sort((a, b) => Number(DANGER.has(a.code)) - Number(DANGER.has(b.code)) || Number(!PRIMARY.includes(a.code)) - Number(!PRIMARY.includes(b.code)));

  return (
    <div className="space-y-2">
      {actions.length === 0 && <p className="text-sm text-slate-500">Энэ шатанд танаас хийх үйлдэл алга.</p>}
      {sorted.map((a, i) => (
        <button
          key={a.code}
          type="button"
          onClick={() => setOpen(a)}
          className={`${DANGER.has(a.code) ? "btn-danger" : i === 0 && PRIMARY.includes(a.code) ? "btn-primary" : "btn-outline"} w-full py-2.5`}
        >
          {a.label}
        </button>
      ))}
      {state?.ok && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>}
      <Toast message={state?.ok} />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && !pending && setOpen(null)}>
          <form action={formAction} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="action" value={open.code} />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">{open.label}</h3>
                {HINT[open.code] && <p className="mt-1 text-sm text-slate-500">{HINT[open.code]}</p>}
              </div>
              <button type="button" onClick={() => setOpen(null)} disabled={pending} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>

            {(open.code === "submit" || open.code === "resubmit" || open.code === "forward") && (
              <div>
                <label className="label">{open.code === "forward" ? "Дараагийн хянагч *" : "Хянагч *"}</label>
                {open.code !== "forward" && autoReviewer ? (
                  <>
                    <select name="reviewerId" className="input" defaultValue="">
                      <option value="">Автоматаар — {autoReviewer.name}</option>
                      {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Чиглүүлэх дүрэм: {autoReviewer.rule}. Өөр хянагч сонгож болно.</p>
                  </>
                ) : (
                  <select name="reviewerId" required className="input" defaultValue={reviewers[0]?.id}>
                    {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {open.code === "approve" && (
              <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-3">
                <label className="label flex items-center gap-1.5"><ShieldCheck size={14} className="text-navy-800" /> Цахим гарын үсэг — нууц үг *</label>
                <input type="password" name="password" required autoFocus autoComplete="current-password" className="input" placeholder="Нэвтрэх нууц үгээ оруулна уу" />
                <p className="mt-1 text-xs text-slate-500">Нууц үгээр таны хувийн түлхүүр нээгдэж, баримтын агуулгын SHA-256 хэшийг зурна. Дараа нь агуулга өөрчлөгдвөл систем илрүүлнэ.</p>
              </div>
            )}

            {(open.code === "assign" || open.code === "reassign") && (
              <>
                <div>
                  <label className="label">Хариуцагч *</label>
                  <select name="assignee" required className="input" defaultValue="">
                    <option value="" disabled>— Ажилтан эсвэл нэгж сонгох —</option>
                    <optgroup label="Ажилтан">
                      {users.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.name}</option>)}
                    </optgroup>
                    <optgroup label="Нэгж (нэгжийн бүх ажилтанд очно)">
                      {departments.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="label">Шийдвэрлэх хугацаа *</label>
                  <input type="date" name="dueDate" required defaultValue={in7} className="input" />
                </div>
              </>
            )}

            {open.code === "archive" && (
              <>
                <div><label className="label">Архивын ангилал</label><input name="archiveCategory" defaultValue={defaultArchiveCategory} className="input" /></div>
                <div><label className="label">Цаасан эхийн байршил</label><input name="storageLocation" placeholder="Жишээ: Архив 2-р тавиур, хайрцаг 14" className="input" /></div>
                <div>
                  <label className="label">Хадгалах хугацааны дараа</label>
                  <select name="disposalAction" className="input">
                    <option value="DESTROY">Устгах</option>
                    <option value="TRANSFER">Улсын архивт шилжүүлэх</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="label">
                {open.code === "resolve" ? "Шийдвэрлэлтийн үр дүн" : COMMENT_REQUIRED.has(open.code) ? "Шалтгаан" : "Тайлбар (заавал биш)"}
                {COMMENT_REQUIRED.has(open.code) && <span className="text-red-600"> *</span>}
              </label>
              <textarea name="comment" rows={3} required={COMMENT_REQUIRED.has(open.code)} autoFocus={COMMENT_REQUIRED.has(open.code)} className="input" />
            </div>

            {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

            <div className="flex gap-2 pt-1">
              <button disabled={pending} className={`${DANGER.has(open.code) ? "btn-danger" : "btn-primary"} flex-1 py-2.5`}>
                {pending ? <><Spinner /> Түр хүлээнэ үү…</> : `${open.label} — баталгаажуулах`}
              </button>
              <button type="button" disabled={pending} onClick={() => setOpen(null)} className="btn-outline py-2.5">Болих</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
