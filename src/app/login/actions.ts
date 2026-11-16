"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Нэвтрэх нэрээ оруулна уу"),
  password: z.string().min(1, "Нууц үгээ оруулна уу"),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username }, include: { employee: true } });

  if (!user) return { error: "Нэвтрэх нэр эсвэл нууц үг буруу байна" };

  // ФБШ-01: 5 удаа дараалан буруу оруулбал бүртгэл 15 минут түгжигдэнэ
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const min = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000);
    return { error: `Нууц үгийг олон удаа буруу оруулсан тул бүртгэл түгжигдсэн. ${min} минутын дараа дахин оролдоно уу` };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const failed = (user.lockedUntil ? 0 : user.failedLoginCount) + 1; // түгжээ дууссан бол тоолуурыг шинээр эхлүүлнэ
    const lock = failed >= MAX_FAILED;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60000) : null },
    });
    if (lock) return { error: `Нууц үгийг ${MAX_FAILED} удаа буруу оруулсан тул бүртгэл ${LOCK_MINUTES} минут түгжигдлээ` };
    return { error: `Нэвтрэх нэр эсвэл нууц үг буруу байна. Үлдсэн оролдлого: ${MAX_FAILED - failed}` };
  }
  if (!user.isActive || user.employee.employmentStatus !== "ACTIVE") {
    return { error: "Таны эрх идэвхгүй байна. Администраторт хандана уу" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null } });
  await writeAudit({ userId: user.id, action: "LOGIN", entityType: "user", entityId: user.id });

  (await cookies()).set(SESSION_COOKIE, await encryptSession({ userId: user.id, username: user.username }), sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
