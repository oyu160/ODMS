import Link from "next/link";
import { FileSpreadsheet, Printer, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { findReport, visibleReports, periodLabel } from "@/lib/reports";
import { PageHeader, Card, makeHref } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Түгээмэл хугацааны сонголт: энэ сар, өмнөх сар, энэ улирал, энэ жил */
function presets() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ulaanbaatar" }));
  const y = d.getFullYear(), m = d.getMonth();
  const iso = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10);
  const today = iso(y, m, d.getDate());
  const q = Math.floor(m / 3) * 3;
  return [
    { label: "Энэ сар", from: iso(y, m, 1), to: today },
    { label: "Өмнөх сар", from: iso(y, m - 1, 1), to: iso(y, m, 0) },
    { label: "Энэ улирал", from: iso(y, q, 1), to: today },
    { label: "Энэ жил", from: iso(y, 0, 1), to: today },
    { label: "Сүүлийн 12 сар", from: iso(y - 1, m, d.getDate()), to: today },
  ];
}

type SP = Promise<{ r?: string; from?: string; to?: string; department?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePermission("report.view");
  const sp = await searchParams;
  const reports = visibleReports(user);
  const report = findReport(sp.r) && reports.some((x) => x.key === sp.r) ? findReport(sp.r)! : reports[0];
  const params = { from: sp.from, to: sp.to, department: sp.department };
  const [result, departments] = await Promise.all([report.run(user, params), prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })]);
  const q = { r: report.key, from: sp.from, to: sp.to, department: sp.department };

  return (
    <div>
      <PageHeader crumbs={[["Тайлан"]]} title="Тайлан" subtitle="Огнооны мужаар шүүж, Excel болон PDF (хэвлэх) хэлбэрээр татна. Зөвхөн таны эрхийн хүрээний баримт орно." />

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <nav className="space-y-2" aria-label="Тайлангийн жагсаалт">
          {reports.map((r) => (
            <Link
              key={r.key}
              href={makeHref("/reports", { from: sp.from, to: sp.to }, { r: r.key })}
              aria-current={r.key === report.key ? "page" : undefined}
              className={`block rounded-xl border p-4 transition ${r.key === report.key ? "border-navy-800 bg-white ring-1 ring-navy-800" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <div className="flex items-center gap-2 font-semibold"><BarChart3 size={16} aria-hidden className="text-navy-700" />{r.title}</div>
              <div className="mt-1 text-xs text-slate-500">{r.audience}</div>
            </Link>
          ))}
        </nav>

        <div className="space-y-5">
          <Card>
            <div className="mb-4">
              <h2 className="text-lg font-bold">{report.title}</h2>
              <p className="text-sm text-slate-500">{report.description}</p>
            </div>
            <form className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="r" value={report.key} />
              <div><label className="label" htmlFor="rp-from">Эхлэх огноо</label><input id="rp-from" type="date" name="from" defaultValue={sp.from} className="input" /></div>
              <div><label className="label" htmlFor="rp-to">Дуусах огноо</label><input id="rp-to" type="date" name="to" defaultValue={sp.to} className="input" /></div>
              {(report.key === "registration" || report.key === "overdue") && (
                <div>
                  <label className="label" htmlFor="rp-dept">Нэгж</label>
                  <select id="rp-dept" name="department" defaultValue={sp.department ?? ""} className="input">
                    <option value="">Бүх нэгж</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <button className="btn-primary">Харах</button>
              <div className="ml-auto flex gap-2">
                <a href={makeHref(`/api/reports/${report.key}`, q, {})} className="btn-outline"><FileSpreadsheet size={16} /> Excel</a>
                <a href={makeHref("/print/report", q, {})} target="_blank" className="btn-outline"><Printer size={16} /> PDF / Хэвлэх</a>
              </div>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Хамрах хугацаа: <b className="text-slate-700">{periodLabel(params)}</b></span>
              <span className="text-slate-300" aria-hidden>|</span>
              {presets().map((pr) => (
                <Link key={pr.label} href={makeHref("/reports", { r: report.key, department: sp.department }, { from: pr.from, to: pr.to })} aria-current={sp.from === pr.from && sp.to === pr.to ? "true" : undefined} className={`rounded-full border px-2.5 py-1 font-medium ${sp.from === pr.from && sp.to === pr.to ? "border-navy-800 bg-navy-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-navy-600"}`}>{pr.label}</Link>
              ))}
            </div>
          </Card>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50/60">
                  <tr>{result.columns.map((c) => <th key={c} className="th whitespace-nowrap">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">{r.map((c, j) => <td key={j} className="td">{c}</td>)}</tr>
                  ))}
                  {result.rows.length === 0 && <tr><td colSpan={result.columns.length} className="px-4 py-12 text-center text-sm text-slate-500">Сонгосон хугацаанд өгөгдөл алга. Хугацааг өргөтгөж эсвэл дээрх товчнуудаас сонгоно уу.</td></tr>}
                </tbody>
                {result.footer && result.rows.length > 0 && (
                  <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                    <tr>{result.footer.map((c, j) => <td key={j} className="td">{c}</td>)}</tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
