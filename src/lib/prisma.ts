import { PrismaClient } from "@prisma/client";

// Hugjuuleltiin ued hot reload burt shine holbolt neegdehees sergiilne
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

// Hawsraltiin aguulga (content) tom tul jagsaalt, delgerenguid anhdagchaar unshihgui.
// Zuwhun fail tatah ued `omit: { content: false }`-eer awna. Profailiin zurag (avatar)-iig mun adil.
function createClient() {
  return new PrismaClient({ omit: { attachment: { content: true }, user: { avatar: true } } });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
