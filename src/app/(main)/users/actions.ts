"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { syncFromHR, HrTimeoutError } from "@/lib/hr";
import { fmtDateTime } from "@/lib/format";

const go = (msg: string) => redirect(`/users?msg=${encodeURIComponent(msg)}`);

export async function toggleUser(fd: FormData) {
  const admin = await requirePermission("user.manage");
  const id = String(fd.get("id"));
  if (id === admin.id) go("Өөрийн эрхийг идэвхгүй болгох боломжгүй");
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isActive: !u.isActive } });
  await writeAudit({ userId: admin.id, entityType: "user", entityId: id, action: u.isActive ? "USER_DISABLE" : "USER_ENABLE" });
  revalidatePath("/users");
  go(u.isActive ? "Хэрэглэгчийг идэвхгүй болгов" : "Хэрэглэгчийг идэвхжүүлэв");
}

export async function setRoles(fd: FormData) {
  const admin = await requirePermission("user.manage");
  const id = String(fd.get("id"));
  const roleIds = fd.getAll("roleId").map(String);
  if (roleIds.length === 0) go("Дор хаяж нэг үүрэг сонгоно уу");
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: id } }),
    prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) }),
  ]);
  await writeAudit({ userId: admin.id, entityType: "user", entityId: id, action: "ROLE_CHANGE", newValue: { roles: roleIds.length } });
  revalidatePath("/users");
  go("Үүрэг шинэчлэгдлээ");
}

export async function resetPassword(fd: FormData) {
  const admin = await requirePermission("user.manage");
  const id = String(fd.get("id"));
  const temp = `Bsu-${Math.random().toString(36).slice(2, 8)}`;
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temp, 10) } });
  await writeAudit({ userId: admin.id, entityType: "user", entityId: id, action: "PASSWORD_RESET" });
  go(`Түр нууц үг: ${temp} — хэрэглэгчид дамжуулна уу`);
}

export async function createUser(fd: FormData) {
  const admin = await requirePermission("user.manage");
  const employeeId = String(fd.get("employeeId"));
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const roleId = String(fd.get("roleId"));
  if (!employeeId || !username || !roleId) go("Ажилтан, нэвтрэх нэр, үүргийг бөглөнө үү");
  if (await prisma.user.findUnique({ where: { username } })) go("Ийм нэвтрэх нэр бүртгэлтэй байна");
  const temp = `Bsu-${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({ data: { employeeId, username, passwordHash: await bcrypt.hash(temp, 10), roles: { create: { roleId } } } });
  await writeAudit({ userId: admin.id, entityType: "user", entityId: u.id, action: "USER_CREATE" });
  revalidatePath("/users");
  go(`Хэрэглэгч үүслээ. Түр нууц үг: ${temp}`);
}

export async function runHrSync() {
  const admin = await requirePermission("user.manage");
  let msg: string;
  try {
    const r = await syncFromHR();
    await writeAudit({ userId: admin.id, entityType: "hr_sync", action: "HR_SYNC", newValue: r });
    msg = `HR синк: ${r.departments} нэгж, ${r.added} шинэ ажилтан, ${r.updated} шинэчлэгдсэн, ${r.left} ажлаас гарсан (${r.deactivatedUsers} эрх хаагдсан)`;
  } catch (e) {
    if (e instanceof HrTimeoutError) {
      // Sistem zogsohgui: umnu sinhronchilson ajiltnii medeelleer urgeljluulen ajillana
      const last = await prisma.employee.aggregate({ _max: { syncedAt: true } });
      msg = `Анхааруулга: ${e.message}. Сүүлд синхрончилсон (${fmtDateTime(last._max.syncedAt)}) мэдээллийг ашиглаж байна.`;
    } else {
      msg = `HR синк амжилтгүй: ${(e as Error).message}`;
    }
  }
  revalidatePath("/users");
  go(msg);
}
