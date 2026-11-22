"use client";

import { useActionState } from "react";
import { FileStack, ShieldCheck } from "lucide-react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><FileStack size={22} /></span>
          <span className="text-sm text-white/70">[Байгууллагын нэр]</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Баримт бичгийн<br />удирдлагын систем</h1>
          <p className="mt-4 max-w-md text-white/70">Баримтыг үүсгэх, хянах, батлах, бүртгэх, хуваарилах, архивлах бүх үе шатыг нэг дор хөтөлнө.</p>
        </div>
        <div className="text-xs text-white/50">Зөвхөн байгууллагын дотоод хэрэглэгчдэд зориулав</div>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-6">
        <form action={action} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Нэвтрэх</h2>
            <p className="mt-1 text-sm text-slate-500">Байгууллагын хэрэглэгчийн нэр, нууц үгээ оруулна уу</p>
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
