// Medegdel deer darahad: unshsan bolgood holbogdoh barimt ruu shiljuulne
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Caddy proksi ard req.url dotood hayag (0.0.0.0:3000) baidag tul haritsangui (relative) hayag ruu shiljuulne
const go = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return go("/login");
  const { id } = await params;
  const n = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!n) return go("/notifications");
  if (!n.isRead) await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return go(n.documentId ? `/documents/${n.documentId}` : "/notifications");
}
