// Tailangiin hewleh (PDF) huwilbar — diplomiin Zurag 3.19-iin zagwaraar
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { findReport, periodLabel } from "@/lib/reports";
import { fmtDateTime } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type SP = Promise<{ r?: string; from?: string; to?: string; department?: string }>;

export default async function PrintReport({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const report = findReport(sp.r);
  if (!report || !can(user, report.permission)) notFound();
  const p = { from: sp.from, to: sp.to, department: sp.department };
  const result = await report.run(user, p);
  await writeAudit({ userId: user.id, entityType: "report", action: "PRINT", newValue: { report: report.key } });

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      {/* 3.4: PDF/hewlemeld huudas buriin dood baruun buland «Huudas N / M». Chrome, Edge 131+ demjine. */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 14mm 12mm 16mm;
          @bottom-right { content: "Хуудас " counter(page) " / " counter(pages); font-family: serif; font-size: 10px; color: #475569; }
          @bottom-left { content: ${JSON.stringify(report.title)}; font-family: serif; font-size: 10px; color: #475569; }
        }
        @media print { thead { display: table-header-group; } tr { break-inside: avoid; } }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[297mm] justify-end"><PrintButton /></div>
      <div className="mx-auto max-w-[297mm] bg-white px-14 py-12 font-serif text-[13px] text-slate-900 shadow print:shadow-none">
        <div className="flex justify-between">
          <b className="text-[15px]">[БАЙГУУЛЛАГЫН НЭР]</b>
          <span>Баримт бичгийн удирдлагын систем</span>
        </div>
        <h1 className="mt-6 text-center text-xl font-bold uppercase">{report.title}</h1>
        <div className="mt-5 grid grid-cols-2 gap-x-10 gap-y-1">
          <div><span className="inline-block w-36 text-slate-600">Хамрах хугацаа:</span>{periodLabel(p)}</div>
          <div><span className="inline-block w-36 text-slate-600">Тайлан гаргасан:</span>{user.fullName}, {user.roles[0]?.name}</div>
          <div><span className="inline-block w-36 text-slate-600">Шүүлтүүр:</span>{p.department ? "Сонгосон нэгж" : "Бүх нэгж"}</div>
          <div><span className="inline-block w-36 text-slate-600">Гаргасан огноо:</span>{fmtDateTime(new Date())}</div>
        </div>
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr>{result.columns.map((c) => <th key={c} className="border border-slate-700 bg-slate-100 px-2 py-1.5 text-center">{c}</th>)}</tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-slate-700 px-2 py-1.5">{c}</td>)}</tr>)}
            {result.rows.length === 0 && <tr><td colSpan={result.columns.length} className="border border-slate-700 px-2 py-4 text-center">Өгөгдөл алга</td></tr>}
          </tbody>
          {result.footer && (
            <tfoot><tr>{result.footer.map((c, j) => <td key={j} className="border border-slate-700 bg-slate-50 px-2 py-1.5 font-bold">{c}</td>)}</tr></tfoot>
          )}
        </table>
        <div className="mt-10 flex justify-between">
          <span>Хянасан: ............................. /{user.fullName}/</span>
          <span>Тайланг системээс автоматаар үүсгэв.</span>
        </div>
      </div>
    </div>
  );
}
