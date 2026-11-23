import { ORG_NAME } from "@/lib/org";
// Tailang Excel bolgon tatah
import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/auth";
import { findReport, periodLabel } from "@/lib/reports";
import { writeAudit } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нэвтрээгүй байна", { status: 401 });
  const report = findReport((await params).key);
  if (!report) return new Response("Тайлан олдсонгүй", { status: 404 });
  if (!can(user, report.permission)) return new Response("Энэ тайланг харах эрхгүй байна", { status: 403 }); // FBSh-02

  const sp = new URL(req.url).searchParams;
  const p = { from: sp.get("from") || undefined, to: sp.get("to") || undefined, department: sp.get("department") || undefined };
  const result = await report.run(user, p);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(report.title.slice(0, 31));
  ws.addRow([ORG_NAME]).font = { bold: true };
  ws.addRow([report.title]).font = { bold: true, size: 14 };
  ws.addRow([`Хамрах хугацаа: ${periodLabel(p)}`]);
  ws.addRow([`Гаргасан: ${user.fullName} · ${fmtDateTime(new Date())}`]);
  ws.addRow([]);
  const head = ws.addRow(result.columns);
  head.font = { bold: true };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F8" } };
    c.border = { bottom: { style: "thin" } };
  });
  result.rows.forEach((r) => ws.addRow(r));
  if (result.footer) ws.addRow(result.footer).font = { bold: true };
  result.columns.forEach((c, i) => (ws.getColumn(i + 1).width = Math.max(8, Math.min(48, c.length + 6, ...result.rows.map((r) => String(r[i] ?? "").length + 2)))));

  await writeAudit({ userId: user.id, entityType: "report", action: "EXPORT", newValue: { report: report.key, rows: result.rows.length } });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(report.title + ".xlsx")}`,
    },
  });
}
