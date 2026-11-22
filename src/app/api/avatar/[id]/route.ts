// Profailiin zurag — zuwhun newtersen hereglegch harna
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нэвтрээгүй байна", { status: 401 });

  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { avatar: true, avatarMime: true } });
  if (!u?.avatar || !u.avatarMime) return new Response("Зураг олдсонгүй", { status: 404 });

  return new Response(Buffer.from(u.avatar), {
    headers: { "Content-Type": u.avatarMime, "Cache-Control": "private, max-age=86400" },
  });
}
