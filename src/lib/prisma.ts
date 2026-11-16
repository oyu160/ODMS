import { PrismaClient } from "@prisma/client";

// Хөгжүүлэлтийн үед hot reload бүрт шинэ холболт нээгдэхээс сэргийлнэ
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

// Хавсралтын агуулга (content) том тул жагсаалт, дэлгэрэнгүйд анхдагчаар уншихгүй.
// Зөвхөн файл татах үед `omit: { content: false }`-ээр авна.
function createClient() {
  return new PrismaClient({ omit: { attachment: { content: true } } });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
