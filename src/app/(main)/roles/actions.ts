"use server";

// Erhiin tohirgoo hadgalah (bizness logikiin tuwshin) — huudas zuwhun haruulna
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function savePermissions(fd: FormData) {
  const admin = await requirePermission("user.manage");
  const pairs = fd.getAll("rp").map(String).map((x) => x.split(":") as [string, string]);
  const roles = await prisma.role.findMany();
  await prisma.$transaction([
    // Administratoriin erh udirdah erhiig haswal sistemd hen ch newterch zasah bolomjgui bolno — hamgaalna
    prisma.rolePermission.deleteMany({ where: { NOT: { role: { code: "ADMIN" }, permission: { code: "user.manage" } } } }),
    prisma.rolePermission.createMany({ data: pairs.map(([roleId, permissionId]) => ({ roleId, permissionId })), skipDuplicates: true }),
  ]);
  await writeAudit({ userId: admin.id, entityType: "role_permission", action: "SETTINGS", newValue: { roles: roles.length, pairs: pairs.length } });
  revalidatePath("/roles");
}
