// Хавсралт татах — хэрэглэгч тухайн баримтыг харах эрхтэй эсэхийг шалгана
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { documentScope } from "@/lib/access";
import { loadFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нэвтрээгүй байна", { status: 401 });

  const { id } = await params;
  const att = await prisma.attachment.findFirst({ where: { id, document: documentScope(user) }, omit: { content: false } });
  if (!att) {
    // ФБШ-02: файл байгаа боловч хэрэглэгчийн эрхийн хүрээнд биш бол 403
    const exists = await prisma.attachment.count({ where: { id } });
    return exists ? new Response("Энэ файлыг харах эрхгүй байна", { status: 403 }) : new Response("Файл олдсонгүй", { status: 404 });
  }

  const data = await loadFile(att);
  await writeAudit({ userId: user.id, documentId: att.documentId, entityType: "attachment", entityId: att.id, action: "DOWNLOAD" });

  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `${new URL(req.url).searchParams.get("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
    },
  });
}
