// Odoogiin hereglegch, erhiin shalgalt (serwer tald)
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { prisma } from "./prisma";
import { SESSION_COOKIE, decryptSession } from "./session";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  initials: string;
  avatarUrl?: string | null;
  employeeId: string;
  positionName: string | null;
  departmentId: string;
  departmentName: string;
  roles: { code: string; name: string }[];
  permissions: Set<string>;
};

/** Neg huseltiin dotor neg l udaa DB-ees unshina */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: { include: { department: true } },
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  // Idewhgui hereglegch eswel ajlaas garsan ajiltan newterch chadahgui
  if (!user || !user.isActive || user.employee.employmentStatus !== "ACTIVE") return null;

  const activeRoles = user.roles.map((ur) => ur.role).filter((r) => r.isActive);
  return {
    id: user.id,
    username: user.username,
    fullName: `${user.employee.lastName.charAt(0)}.${user.employee.firstName}`,
    initials: `${user.employee.lastName.charAt(0)}${user.employee.firstName.charAt(0)}`.toUpperCase(),
    avatarUrl: user.avatarMime ? `/api/avatar/${user.id}?v=${user.avatarUpdatedAt?.getTime() ?? 0}` : null,
    employeeId: user.employeeId,
    positionName: user.employee.positionName,
    departmentId: user.employee.departmentId,
    departmentName: user.employee.department.name,
    roles: activeRoles.map((r) => ({ code: r.code, name: r.name })),
    permissions: new Set(activeRoles.flatMap((r) => r.permissions.map((rp) => rp.permission.code))),
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export { can } from "./permissions";
import { can } from "./permissions";

/** Erhgui bol aldaa shidne — server action buriin ehend duudna */
export async function requirePermission(permission: string) {
  const user = await requireUser();
  // FBSh-02: erhgui huselted HTTP 403 butsaana (src/app/forbidden.tsx)
  if (!can(user, permission)) forbidden();
  return user;
}
