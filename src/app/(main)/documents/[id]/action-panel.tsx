"use client";

// Үйлдлийн товчнууд: товч дарахад тухайн үйлдлийн цонх (modal) нээгдэж,
// шаардлагатай мэдээллээ бөглөөд үндсэн товчийг дарна.
import { useActionState, useEffect, useState } from "react";
import { ShieldCheck, Send, Undo2, UserPlus, Archive, CircleCheck, Ban, Inbox, FileCheck } from "lucide-react";
import { runAction, type ActionState } from "./actions";
import { Toast, Spinner } from "@/components/feedback";
import { Modal, ModalFooter } from "@/components/modal";

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
  /** Батлах цонхны дүгнэлтэд: гарын үсэг зурагч ба баримт */
  signer?: string;
  documentLabel?: string;
};

const PRIMARY = ["approve", "submit", "resubmit", "register", "register_incoming", "assign", "resolve", "archive"];
const DANGER = new Set(["cancel"]);
const COMMENT_REQUIRED = new Set(["return", "resolve", "cancel"]);
/** Цонхны үндсэн товчны нэр — юу болохыг шууд хэлнэ */
const CONFIRM: Record<string, string> = {
  approve: "Батлах ба гарын үсэг зурах",
  submit: "Хяналтад илгээх",
  resubmit: "Дахин илгээх",
  return: "Засварт буцаах",
  forward: "Шилжүүлэх",
  register: "Бүртгэх",
  register_incoming: "Бүртгэж дугаар олгох",
  assign: "Хуваарилах",
  reassign: "Дахин хуваарилах",
  resolve: "Шийдвэрлэсэн гэж тэмдэглэх",
  archive: "Архивлах",
  cancel: "Баримтыг цуцлах",
};
const ICON: Record<string, React.ReactNode> = {
  approve: <ShieldCheck size={20} />, submit: <Send size={20} />, resubmit: <Send size={20} />, return: <Undo2 size={20} />, forward: <UserPlus size={20} />,
  register: <FileCheck size={20} />, register_incoming: <Inbox size={20} />, assign: <UserPlus size={20} />, reassign: <UserPlus size={20} />,
  resolve: <CircleCheck size={20} />, archive: <Archive size={20} />, cancel: <Ban size={20} />,
};

const HINT: Record<string, string> = {
  submit: "Баримт хянагч руу илгээгдэж, та засах боломжгүй болно. Хянагч засварт буцаавал дахин засна.",
  resubmit: "Зассан баримтыг хянагч руу дахин илгээнэ.",
  approve: "Батлахад систем албан ёсны дугаар олгож, таны цахим гарын үсгээр баталгаажуулна.",
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

export function ActionPanel({ documentId, actions, reviewers = [], users = [], departments = [], defaultArchiveCategory, autoReviewer, signer, documentLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(runAction, undefined);
  const [open, setOpen] = useState<{ code: string; label: string } | null>(null);

  // Амжилттай болмогц цонхыг хаана
  useEffect(() => {
    if (state?.ok) setOpen(null);
  }, [state]);

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
      <Toast message={state?.ok} />

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        busy={pending}
        size={open?.code === "assign" || open?.code === "reassign" ? "lg" : "md"}
        variant={open && DANGER.has(open.code) ? "alert" : "dialog"}
        icon={open ? ICON[open.code] : undefined}
        iconTone={open && DANGER.has(open.code) ? "danger" : "brand"}
        title={open?.label}
        description={open ? (documentLabel ? <><span className="block">{documentLabel}</span>{HINT[open.code] && <span className="mt-1 block">{HINT[open.code]}</span>}</> : HINT[open.code]) : undefined}
      >
        {open && (
          <form action={formAction}>
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="action" value={open.code} />
            <div className="space-y-4 px-6 pb-2">
              {(open.code === "submit" || open.code === "resubmit" || open.code === "forward") && (
                <div>
                  <label className="label" htmlFor="act-reviewer">{open.code === "forward" ? "Дараагийн хянагч" : "Хянагч"} <span className="text-red-600">*</span></label>
                  {open.code !== "forward" && autoReviewer ? (
                    <>
                      <select id="act-reviewer" name="reviewerId" className="input" defaultValue="" aria-describedby="act-reviewer-help">
                        <option value="">Автоматаар — {autoReviewer.name}</option>
                        {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <p id="act-reviewer-help" className="mt-1 text-xs text-slate-500">Чиглүүлэх дүрэм: {autoReviewer.rule}. Өөр хянагч сонгож болно.</p>
                    </>
                  ) : (
                    <select id="act-reviewer" name="reviewerId" required className="input" defaultValue={reviewers[0]?.id}>
                      {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {open.code === "approve" && (
                <>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <dt className="text-slate-500">Албан дугаар</dt><dd className="text-right font-semibold text-slate-900">Батлахад автоматаар олгогдоно</dd>
                    {signer && <><dt className="text-slate-500">Гарын үсэг зурагч</dt><dd className="text-right font-semibold text-slate-900">{signer}</dd></>}
                    <dt className="text-slate-500">Арга</dt><dd className="text-right font-semibold text-slate-900">Ed25519 · SHA-256</dd>
                  </dl>
                  <div>
                    <label className="label" htmlFor="sign-password">Нууц үг <span className="text-red-600">*</span></label>
                    <input id="sign-password" type="password" name="password" required autoFocus autoComplete="current-password" className="input" aria-describedby="sign-password-help" />
                    <p id="sign-password-help" className="mt-1 text-xs text-slate-500">Нэвтрэх нууц үгээр таны хувийн түлхүүр нээгдэж, агуулгын хэшийг зурна. Дараа нь агуулга өөрчлөгдвөл систем илрүүлнэ.</p>
                  </div>
                </>
              )}

              {(open.code === "assign" || open.code === "reassign") && (
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <div>
                    <label className="label" htmlFor="act-assignee">Хариуцагч <span className="text-red-600">*</span></label>
                    <select id="act-assignee" name="assignee" required className="input" defaultValue="">
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
                    <label className="label" htmlFor="act-due">Шийдвэрлэх хугацаа <span className="text-red-600">*</span></label>
                    <input id="act-due" type="date" name="dueDate" required defaultValue={in7} className="input" />
                  </div>
                </div>
              )}

              {open.code === "archive" && (
                <>
                  <div><label className="label" htmlFor="act-cat">Архивын ангилал</label><input id="act-cat" name="archiveCategory" defaultValue={defaultArchiveCategory} className="input" /></div>
                  <div><label className="label" htmlFor="act-loc">Цаасан эхийн байршил</label><input id="act-loc" name="storageLocation" placeholder="Жишээ: Архив 2-р тавиур, хайрцаг 14" className="input" /></div>
                  <div>
                    <label className="label" htmlFor="act-disp">Хадгалах хугацааны дараа</label>
                    <select id="act-disp" name="disposalAction" className="input">
                      <option value="DESTROY">Устгах</option>
                      <option value="TRANSFER">Улсын архивт шилжүүлэх</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="label" htmlFor="act-comment">
                  {open.code === "resolve" ? "Шийдвэрлэлтийн үр дүн" : COMMENT_REQUIRED.has(open.code) ? "Шалтгаан" : <>Тайлбар <span className="font-normal text-slate-500">(заавал биш)</span></>}
                  {COMMENT_REQUIRED.has(open.code) && <span className="text-red-600"> *</span>}
                </label>
                <textarea id="act-comment" name="comment" rows={3} required={COMMENT_REQUIRED.has(open.code)} autoFocus={COMMENT_REQUIRED.has(open.code)} className="input" />
              </div>

              {state?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
            </div>

            <ModalFooter>
              <button type="button" disabled={pending} onClick={() => setOpen(null)} className="btn-outline">Болих</button>
              <button disabled={pending} aria-busy={pending} className={DANGER.has(open.code) ? "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60" : "btn-primary"}>
                {pending ? <><Spinner /> Түр хүлээнэ үү…</> : CONFIRM[open.code] ?? open.label}
              </button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </div>
  );
}
