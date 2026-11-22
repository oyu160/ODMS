// BD-10: hugatsaa hetersen huwaarilaltiin awtomat sanuulga
// Serwer ajillaj baih hugatsaand tsag tutam shalgana (src/instrumentation.ts).
import { prisma } from "./prisma";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Hugatsaa ni ungursun, shiidwerlegdeegui huwaarilalt burd neg udaa medegdel ilgeene */
export async function notifyOverdueAssignments(now = new Date()) {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const overdue = await prisma.assignment.findMany({
    where: { status: "ACTIVE", dueDate: { lt: today } },
    include: { document: { select: { title: true } } },
  });
  let sent = 0;
  for (const a of overdue) {
    // Ene huwaarilaltad umnu ni awtomat sanuulga yawsan bol dawtahgui
    const already = await prisma.notification.findFirst({
      where: { documentId: a.documentId, type: "OVERDUE", createdAt: { gte: a.assignedAt } },
      select: { id: true },
    });
    if (already) continue;

    if (!a.dueDate) continue;
    const days = Math.floor((today.getTime() - a.dueDate.getTime()) / 86_400_000);
    const msg = `«${a.document.title}» баримтын шийдвэрлэх хугацаа ${days} хоног хэтэрсэн`;
    const users = a.assigneeUserId
      ? [a.assigneeUserId]
      : (await prisma.user.findMany({
          where: { isActive: true, employee: { departmentId: a.assigneeDepartmentId!, employmentStatus: "ACTIVE" } },
          select: { id: true },
        })).map((u) => u.id);
    // Hariutsagch bolon huwaarilsan ajiltand medegdene
    const to = [...new Set([...users, a.assignedById])];
    await prisma.notification.createMany({
      data: to.map((userId) => ({ userId, documentId: a.documentId, type: "OVERDUE", message: msg })),
    });
    sent++;
  }
  return sent;
}

export function startOverdueScheduler() {
  const run = () => notifyOverdueAssignments().catch((e) => console.error("Хугацаа хэтрэлтийн шалгалт:", e));
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
