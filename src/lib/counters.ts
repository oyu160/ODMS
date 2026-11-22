// Tsesnii temdeglegeend haragdah toonuud
import { prisma } from "./prisma";
import { can, type CurrentUser } from "./auth";
import { documentScope } from "./access";
import { startOfToday } from "./format";

export async function shellCounts(user: CurrentUser) {
  const [reviews, mine, overdue, unread, notifications] = await Promise.all([
    prisma.approval.count({ where: { reviewerId: user.id, decision: "PENDING" } }),
    prisma.assignment.count({
      where: { status: "ACTIVE", OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] },
    }),
    can(user, "document.assign")
      ? prisma.assignment.count({ where: { status: "ACTIVE", dueDate: { lt: startOfToday() }, document: documentScope(user) } })
      : Promise.resolve(0),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  return { reviews, assignments: can(user, "document.assign") ? overdue : mine, unread, notifications };
}
