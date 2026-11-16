// Баримтын жагсаалтыг Excel (.xlsx) болгон татах — дэлгэцийн шүүлтүүртэй ижил
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildWhere, readFilter } from "@/lib/document-filters";
import { DIRECTION_LABELS, fmtDate, shortName } from "@/lib/format";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нэвтрээгүй байна", { status: 401 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const docs = await prisma.document.findMany({
    where: buildWhere(user, readFilter(sp)),
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { status: true, documentType: true, ownerDepartment: true, createdBy: { include: { employee: true } } },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Баримтууд");
  ws.columns = [
    { header: "№", width: 6 },
    { header: "Дугаар", width: 14 },
    { header: "Дотоод дугаар", width: 14 },
    { header: "Гарчиг", width: 48 },
    { header: "Төрөл", width: 20 },
    { header: "Чиглэл", width: 10 },
    { header: "Нэгж", width: 28 },
    { header: "Бүртгэсэн", width: 16 },
    { header: "Огноо", width: 12 },
    { header: "Төлөв", width: 18 },
  ];
  docs.forEach((d, i) =>
    ws.addRow([i + 1, d.documentNumber ?? "", d.internalNumber, d.title, d.documentType.name, DIRECTION_LABELS[d.direction], d.ownerDepartment.name, shortName(d.createdBy.employee), fmtDate(d.documentDate ?? d.createdAt), d.status.name]),
  );
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F8" } };

  await writeAudit({ userId: user.id, entityType: "report", action: "EXPORT", newValue: { report: "documents", rows: docs.length } });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("Баримтын_жагсаалт.xlsx")}`,
    },
  });
}
