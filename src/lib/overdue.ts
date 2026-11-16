// БД-10: хугацаа хэтэрсэн хуваарилалтын автомат сануулга
// Сервер ажиллаж байх хугацаанд цаг тутам шалгана (src/instrumentation.ts).
import { prisma } from "./prisma";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Хугацаа нь өнгөрсөн, шийдвэрлэгдээгүй хуваарилалт бүрд нэг удаа мэдэгдэл илгээнэ */
export async function notifyOverdueAssignments(now = new Date()) {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const overdue = await prisma.assignment.findMany({
    where: { status: "ACTIVE", dueDate: { lt: today } },
    include: { document: { select: { title: true } } },
  });
  let sent = 0;
  for (const a of overdue) {
    // Энэ хуваарилалтад өмнө нь автомат сануулга явсан бол давтахгүй
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
    // Хариуцагч болон хуваарилсан ажилтанд мэдэгдэнэ
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
