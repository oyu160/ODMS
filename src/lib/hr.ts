// Hunii nuutsiin sistemtei REST API-aar sinhronchloh (diplomiin 3.5-iin API geree)
// GET {HR_API_URL}/departments → [{ code, name, parentCode }]
// GET {HR_API_URL}/employees   → [{ code, lastName, firstName, position, departmentCode, email, status: "ACTIVE" | "LEFT" }]
import "server-only";
import { prisma } from "./prisma";

type HrDept = { code: string; name: string; parentCode?: string | null };
type HrEmp = { code: string; lastName: string; firstName: string; position?: string; departmentCode: string; email?: string; status: "ACTIVE" | "LEFT" };

/** FBSh-10: hunii nuutsiin sistem 5 sekunded hariu uguhgui bol huleehee zogsoono */
export const HR_TIMEOUT_MS = 5000;
export class HrTimeoutError extends Error {}

async function get<T>(path: string): Promise<T> {
  const base = process.env.HR_API_URL || "http://localhost:3000/api/hr/mock";
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: { "x-api-key": process.env.HR_API_KEY ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(HR_TIMEOUT_MS),
    });
  } catch (e) {
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError")
      throw new HrTimeoutError("Хүний нөөцийн систем 5 секундэд хариу өгсөнгүй");
    throw e;
  }
  if (!res.ok) throw new Error(`HR API алдаа: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function syncFromHR() {
  const [depts, emps] = await Promise.all([get<HrDept[]>("/departments"), get<HrEmp[]>("/employees")]);
  const now = new Date();
  let added = 0, updated = 0, left = 0, deactivatedUsers = 0;

  // 1) Negj
  for (const d of depts) {
    await prisma.department.upsert({ where: { code: d.code }, update: { name: d.name, hrRefId: d.code }, create: { code: d.code, name: d.name, hrRefId: d.code } });
  }
  for (const d of depts.filter((x) => x.parentCode)) {
    const parent = await prisma.department.findUnique({ where: { code: d.parentCode! } });
    if (parent) await prisma.department.update({ where: { code: d.code }, data: { parentId: parent.id } });
  }
  const deptByCode = new Map((await prisma.department.findMany()).map((d) => [d.code, d.id]));

  // 2) Ajiltan
  for (const e of emps) {
    const departmentId = deptByCode.get(e.departmentCode);
    if (!departmentId) continue;
    const existing = await prisma.employee.findUnique({ where: { code: e.code }, include: { user: true } });
    const data = { lastName: e.lastName, firstName: e.firstName, positionName: e.position ?? null, departmentId, email: e.email ?? null, employmentStatus: e.status, syncedAt: now };
    if (!existing) {
      await prisma.employee.create({ data: { code: e.code, ...data } });
      added++;
    } else {
      await prisma.employee.update({ where: { id: existing.id }, data });
      updated++;
      // BD-11: ajlaas garsan ajiltnii erhiig haana
      if (e.status === "LEFT" && existing.employmentStatus !== "LEFT") {
        left++;
        if (existing.user?.isActive) {
          await prisma.user.update({ where: { id: existing.user.id }, data: { isActive: false } });
          deactivatedUsers++;
        }
      }
    }
  }
  return { departments: depts.length, added, updated, left, deactivatedUsers };
}

/** Ajlaas garsan / idewhgui hariutsagchtai idewhtei huwaarilalt (dahin huwaarilah shaardlagatai) */
export function orphanedAssignments() {
  return prisma.assignment.findMany({
    where: { status: "ACTIVE", assigneeUser: { OR: [{ isActive: false }, { employee: { employmentStatus: "LEFT" } }] } },
    include: { document: true, assigneeUser: { include: { employee: true } } },
  });
}
