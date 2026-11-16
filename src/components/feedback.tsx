"use client";

// Хэрэглэгчид үйлдлийн үр дүнг мэдрүүлэх жижиг хэсгүүд:
// Toast — баруун доод буланд гарч 4 секундэд алга болох мэдэгдэл
// SubmitButton — илгээж байх үед эргэлдэх дүрс харуулдаг товч
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, CircleAlert, LoaderCircle, X } from "lucide-react";

export function Toast({ message, tone = "success" }: { message?: string; tone?: "success" | "error" }) {
  const [shown, setShown] = useState<string | undefined>(message);
  useEffect(() => {
    setShown(message);
    if (!message) return;
    const t = setTimeout(() => setShown(undefined), 4500);
    return () => clearTimeout(t);
  }, [message]);
  if (!shown) return null;
  const ok = tone === "success";
  return (
    <div role="status" className="toast-in fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ring-1 ring-black/5" style={{ borderColor: ok ? "#bbf7d0" : "#fecaca" }}>
      {ok ? <CircleCheck size={20} className="mt-0.5 shrink-0 text-green-600" /> : <CircleAlert size={20} className="mt-0.5 shrink-0 text-red-600" />}
      <span className="text-sm text-slate-800">{shown}</span>
      <button type="button" onClick={() => setShown(undefined)} className="ml-1 text-slate-400 hover:text-slate-700"><X size={16} /></button>
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="animate-spin" />;
}

/** Серверийн form-д ашиглах товч: дарсны дараа идэвхгүй болж, эргэлдэх дүрс харуулна */
export function SubmitButton({ children, className = "btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className} aria-busy={pending}>
      {pending ? <><Spinner /> {pendingText ?? "Түр хүлээнэ үү…"}</> : children}
    </button>
  );
}
