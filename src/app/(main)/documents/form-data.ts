// Mayagtad shaardlagatai ugugdliig neg dor achaalna (shine bolon zasah huudas)
import "server-only";
import { prisma } from "@/lib/prisma";
import { documentScope } from "@/lib/access";
import { can, type CurrentUser } from "@/lib/auth";
import { shortName, initials } from "@/lib/format";
import type { FormType } from "./document-form";

export async function loadFormData(user: CurrentUser, typeId: string) {
  const [t, employees, departments, reviewers, related, rules] = await Promise.all([
    prisma.documentType.findUnique({
      where: { id: typeId },
      include: { category: true, numberingRule: true, fields: { where: { isActive: true }, orderBy: { displayOrder: "asc" } } },
    }),
    prisma.employee.findMany({ where: { employmentStatus: "ACTIVE" }, include: { department: true }, orderBy: [{ lastName: "asc" }] }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true, id: { not: user.id }, roles: { some: { role: { permissions: { some: { permission: { code: "document.approve" } } } } } } },
      include: { employee: { include: { department: true } }, roles: { include: { role: true } } },
    }),
    prisma.document.findMany({
      // Zuwhun hereglegchiin harah erhtei barimt (nuutslaliin tuwshin hamaarna)
      where: { AND: [documentScope(user), { documentNumber: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, documentNumber: true, title: true },
    }),
    // Ene turuld hamaarah idewhtei chigluuleh durmuud (mayagt deer awtomat hyanagchiig uridchilan haruulna)
    prisma.routingRule.findMany({
      where: { isActive: true, OR: [{ documentTypeId: null }, { documentTypeId: typeId }], reviewerId: { not: user.id } },
      orderBy: { priority: "asc" },
    }),
  ]);
  if (!t) return null;

  const type: FormType = {
    id: t.id,
    code: t.code,
    name: t.name,
    category: t.category.name,
    pattern: t.numberingRule?.pattern ?? null,
    fields: t.fields.map((f) => ({ id: f.id, label: f.label, dataType: f.dataType, isRequired: f.isRequired, options: Array.isArray(f.options) ? (f.options as string[]) : [] })),
  };
  return {
    type,
    employees: employees.map((e) => ({ id: e.id, name: shortName(e), dept: e.department.name, code: e.code })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    reviewers: reviewers.map((r) => ({
      id: r.id,
      name: shortName(r.employee),
      initials: initials(r.employee),
      sub: `${r.roles.map((x) => x.role.name).join(", ")} · ${r.employee.department.name}`,
    })),
    related: related.map((r) => ({ id: r.id, label: `${r.documentNumber} · ${r.title}` })),
    rules: rules
      .filter((r) => reviewers.some((u) => u.id === r.reviewerId))
      .map((r) => ({ id: r.id, name: r.name, documentTypeId: r.documentTypeId, confidentiality: r.confidentiality, direction: r.direction, departmentId: r.departmentId, fieldId: r.fieldId, fieldValue: r.fieldValue, reviewerId: r.reviewerId, priority: r.priority })),
    me: { id: user.id, departmentId: user.departmentId },
    canRegister: can(user, "document.register"),
  };
}
