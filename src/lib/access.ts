// Баримтад хандах эрхийн хүрээ — бүх жагсаалт, тайлан энэ шүүлтүүрийг ашиглана
// Нууцлалын түвшин (Хүснэгт 3.17-ийн тайлбар):
//   NORMAL       — эрх бүхий бүх ажилтан харна
//   INTERNAL     — хариуцах нэгжийн ажилтан болон баримтад оролцогч харна
//   CONFIDENTIAL — зөвхөн баримтад оролцогч (үүсгэгч, хянагч, хариуцагч) болон document.view_all эрхтэй хэрэглэгч
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { can } from "./permissions";

/** Боловсруулагдаж буй (бусдад харагдах ёсгүй) төлөвүүд */
const WORKING = ["DRAFT", "RETURNED"];

export function documentScope(user: CurrentUser): Prisma.DocumentWhereInput {
  if (can(user, "document.view_all")) return { isDeleted: false };

  const participant: Prisma.DocumentWhereInput[] = [
    { createdById: user.id },
    { approvals: { some: { reviewerId: user.id } } },
    { assignments: { some: { OR: [{ assigneeUserId: user.id }, ...(user.departmentId ? [{ assigneeDepartmentId: user.departmentId }] : [])] } } },
  ];
  const published: Prisma.DocumentWhereInput = { status: { code: { notIn: WORKING } } };

  return {
    isDeleted: false,
    OR: [
      ...participant,
      { AND: [published, { confidentiality: "NORMAL" }] },
      ...(user.departmentId ? [{ AND: [published, { confidentiality: "INTERNAL", ownerDepartmentId: user.departmentId }] }] : []),
    ],
  };
}
