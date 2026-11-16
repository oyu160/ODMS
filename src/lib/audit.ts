// Аудитын бүртгэл (Хүснэгт 3.27)
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Db = typeof prisma | Prisma.TransactionClient;

export async function writeAudit(
  entry: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    documentId?: string;
    oldStatusId?: string;
    newStatusId?: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
  },
  db: Db = prisma,
) {
  let ip: string | undefined;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
  } catch {
    // хүсэлтийн гадна (seed, script) дуудагдвал IP-гүй бичнэ
  }
  await db.auditLog.create({ data: { ...entry, ipAddress: ip } });
}
