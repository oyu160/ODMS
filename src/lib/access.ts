// Barimtad handah erhiin huree — buh jagsaalt, tailan ene shuultuuriig ashiglana
// Nuutslaliin tuwshin (Husnegt 3.17-iin tailbar):
//   NORMAL       — erh buhii buh ajiltan harna
//   INTERNAL     — hariutsah negjiin ajiltan bolon barimtad oroltsogch harna
//   CONFIDENTIAL — zuwhun barimtad oroltsogch (uusgegch, hyanagch, hariutsagch) bolon document.view_all erhtei hereglegch
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { can } from "./permissions";

/** Bolowsruulagdaj bui (busdad haragdah yosgui) tuluwuud */
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
