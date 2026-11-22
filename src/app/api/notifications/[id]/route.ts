// Medegdel deer darahad: unshsan bolgood holbogdoh barimt ruu shiljuulne
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { id } = await params;
  const n = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!n) return NextResponse.redirect(new URL("/notifications", req.url));
  if (!n.isRead) await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return NextResponse.redirect(new URL(n.documentId ? `/documents/${n.documentId}` : "/notifications", req.url));
}
