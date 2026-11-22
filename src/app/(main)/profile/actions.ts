"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 1024 * 1024; // 1 MB

/** Hereglegchiin turshiltiin sanal: profailiin zurag oruulah */
export async function uploadAvatar(formData: FormData) {
  const user = await requireUser();
  const back = (q: string): never => redirect(`/profile?${q}`);

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) back("err=" + encodeURIComponent("Зураг сонгоно уу"));
  const f = file as File;
  if (!ALLOWED.includes(f.type)) back("err=" + encodeURIComponent("Зөвхөн JPG, PNG, WEBP зураг оруулна"));
  if (f.size > MAX_SIZE) back("err=" + encodeURIComponent("Зургийн хэмжээ 1 МБ-аас хэтрэхгүй байх ёстой"));

  await prisma.user.update({
    where: { id: user.id },
    data: { avatar: Buffer.from(await f.arrayBuffer()), avatarMime: f.type, avatarUpdatedAt: new Date() },
  });
  await writeAudit({ userId: user.id, entityType: "user", entityId: user.id, action: "AVATAR_UPDATE" });
  revalidatePath("/", "layout");
  back("msg=" + encodeURIComponent("Профайлын зураг шинэчлэгдлээ"));
}

export async function removeAvatar() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { avatar: null, avatarMime: null, avatarUpdatedAt: new Date() } });
  await writeAudit({ userId: user.id, entityType: "user", entityId: user.id, action: "AVATAR_REMOVE" });
  revalidatePath("/", "layout");
  redirect(`/profile?msg=${encodeURIComponent("Профайлын зураг устгагдлаа")}`);
}
