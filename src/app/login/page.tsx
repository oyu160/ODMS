"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ORG_NAME } from "@/lib/org";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* B+: zuun tal tsagaan, baruun tal hureetei kart — haraanii jin tentsweertei, gol towch gantshan */}
      <section className="hidden flex-col justify-between border-r border-slate-200 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <span className="text-lg font-semibold text-slate-900">{ORG_NAME}</span>
        </div>
        <div>
          <h1 className="text-[40px] font-bold leading-tight tracking-tight text-slate-900">Баримт бүр<br />зөв хүнд,<br />зөв хугацаанд.</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600">Баримтыг үүсгэх, хянах, батлах, бүртгэх, илгээх, архивлах бүх үе шатыг нэг дор хөтөлнө.</p>
          <ol aria-label="Баримтын урсгал" className="mt-8 flex flex-wrap gap-1.5 text-xs">
            {["Ноорог", "Хяналт", "Батлах", "Бүртгэх", "Хуваарилах / Илгээх", "Архив"].map((s) => (
              <li key={s} className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-slate-700">{s}</li>
            ))}
          </ol>
        </div>
        <div className="text-xs text-slate-500">Зөвхөн байгууллагын дотоод хэрэглэгчдэд зориулав</div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form action={action} className="w-full max-w-sm space-y-5 rounded-2xl border border-navy-100 bg-white p-8 sm:p-9">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Нэвтрэх</h2>
            <p className="mt-1 text-sm text-slate-600">Байгууллагын хэрэглэгчийн нэр, нууц үгээ оруулна уу</p>
          </div>

          <div>
            <label className="label" htmlFor="username">Нэвтрэх нэр</label>
            <input id="username" name="username" autoComplete="username" required className="input py-2.5" />
          </div>
          <div>
            <label className="label" htmlFor="password">Нууц үг</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input py-2.5" />
          </div>

          {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

          <button disabled={pending} className="btn-primary w-full py-2.5">{pending ? "Нэвтэрч байна…" : "Нэвтрэх"}</button>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={14} /> Нууц үгээ мартсан бол админд хандана уу
          </p>
        </form>
      </section>
    </main>
  );
}
