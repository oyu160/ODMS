// Баримт урсгалын аль шатанд байгааг харуулах алхамын мөр + «Дараагийн алхам» тайлбар
import { Check, ArrowRight, Ban, Hourglass } from "lucide-react";

const REVIEW_FLOW = ["DRAFT", "IN_REVIEW", "APPROVED", "REGISTERED", "ASSIGNED", "RESOLVED", "ARCHIVED"];
const INCOMING_FLOW = ["DRAFT", "REGISTERED", "ASSIGNED", "RESOLVED", "ARCHIVED"];
const LABEL: Record<string, string> = {
  DRAFT: "Ноорог",
  IN_REVIEW: "Хяналт",
  APPROVED: "Батлагдсан",
  REGISTERED: "Бүртгэгдсэн",
  ASSIGNED: "Хуваарилагдсан",
  RESOLVED: "Шийдвэрлэгдсэн",
  ARCHIVED: "Архив",
};

export function WorkflowSteps({ status, direction }: { status: string; direction: string }) {
  if (status === "CANCELLED")
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <Ban size={16} /> Энэ баримт цуцлагдсан тул цаашид үйлдэл хийгдэхгүй.
      </div>
    );
  const flow = direction === "INCOMING" ? INCOMING_FLOW : REVIEW_FLOW;
  const at = status === "RETURNED" ? flow.indexOf("IN_REVIEW") : flow.indexOf(status);

  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {flow.map((s, i) => {
        const done = i < at || status === "ARCHIVED";
        const current = i === at && status !== "ARCHIVED";
        const returned = current && status === "RETURNED";
        return (
          <li key={s} className="flex items-center">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                returned ? "bg-orange-100 text-orange-800 ring-2 ring-orange-300" : current ? "bg-navy-800 text-white ring-4 ring-navy-100" : done ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-400"
              }`}
            >
              {done ? <Check size={13} /> : current ? <Hourglass size={13} /> : <span className="w-[13px] text-center">{i + 1}</span>}
              {returned ? "Засварт буцсан" : LABEL[s]}
            </span>
            {i < flow.length - 1 && <ArrowRight size={14} className={`mx-1.5 ${i < at ? "text-green-500" : "text-slate-300"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Одоо хэн, юу хийх ёстойг энгийн өгүүлбэрээр */
export function NextStep({ text, mine }: { text: string | null; mine: boolean }) {
  if (!text) return null;
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${mine ? "border border-amber-300 bg-amber-50 text-amber-900" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
      <ArrowRight size={16} className="mt-0.5 shrink-0" />
      <span>
        <b>{mine ? "Таны ээлж: " : "Дараагийн алхам: "}</b>
        {text}
        {mine && " Баруун талын «Үйлдэл» хэсгээс сонгоно уу."}
      </span>
    </div>
  );
}
