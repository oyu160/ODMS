// Цахим гарын үсэг (байгууллагын дотоод): Ed25519 + SHA-256
// - Хэрэглэгч бүр өөрийн түлхүүрийн хостой. Хувийн түлхүүрийг нууц үгээс scrypt-ээр гаргасан
//   түлхүүрээр AES-256-GCM шифрлэж хадгалдаг тул нууц үгийг дахин оруулахгүйгээр зурах боломжгүй.
// - Баталсан агуулгыг (гарчиг, агуулга, талбар, хавсралтын хэш, дугаар) каноник JSON болгож
//   SHA-256 хэш гаргаад тэр хэшийг зурна. Дараа нь агуулга өөрчлөгдвөл шалгалт амжилтгүй болно.
// - Энэ нь итгэмжлэгдсэн гэрчилгээний төв (CA)-ийн гэрчилгээтэй хууль ёсны тоон гарын үсэг биш.
import "server-only";
import { generateKeyPairSync, sign, verify } from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sealPrivateKey, openPrivateKey, fingerprintOf, sha256, signingMessage as message, canonicalJson } from "./signature-core";

export { sha256 };

type Db = Prisma.TransactionClient | typeof prisma;

export class SignatureError extends Error {}

async function createKey(db: Db, userId: string, password: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const der = privateKey.export({ format: "der", type: "pkcs8" });
  const row = await db.signingKey.create({
    data: { userId, publicKey: pem, encryptedPrivateKey: sealPrivateKey(der, password), fingerprint: fingerprintOf(pem) },
  });
  return { row, privateKey };
}

/**
 * Нууц үгийг шалгаад хэрэглэгчийн хувийн түлхүүрийг нээнэ. Түлхүүр байхгүй бол шинээр үүсгэнэ.
 * Нууц үг солигдсон (админ сэргээсэн) бол хуучин түлхүүрийг хүчингүй болгож шинийг үүсгэнэ —
 * хуучин гарын үсгүүд хадгалсан нийтийн түлхүүрээрээ шалгагдсаар байна.
 */
export async function unlockSigningKey(db: Db, userId: string, password: string | undefined) {
  if (!password) throw new SignatureError("Цахим гарын үсэг зурахын тулд нууц үгээ оруулна уу");
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new SignatureError("Нууц үг буруу байна. Гарын үсэг зурагдсангүй");

  const current = await db.signingKey.findFirst({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  if (current) {
    try {
      return { row: current, privateKey: openPrivateKey(current.encryptedPrivateKey, password) };
    } catch {
      await db.signingKey.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
    }
  }
  return createKey(db, userId, password);
}

/* ---------- Агуулгын хэш ---------- */

/** Баримтын батлагдсан агуулгыг тогтмол дараалалтай JSON болгоно */
export async function canonicalContent(db: Db, documentId: string, documentNumber?: string | null) {
  const d = await db.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { fieldValues: true, attachments: { select: { id: true, fileName: true, checksumSha256: true } } },
  });
  return canonicalJson({ ...d, documentNumber: documentNumber !== undefined ? documentNumber : d.documentNumber });
}

/** Батлах үед транзакц дотор дуудагдана */
export async function signDocument(db: Db, opts: { documentId: string; userId: string; password?: string; documentNumber: string | null }) {
  const { row, privateKey } = await unlockSigningKey(db, opts.userId, opts.password);
  const hash = sha256(await canonicalContent(db, opts.documentId, opts.documentNumber));
  const signedAt = new Date();
  signedAt.setMilliseconds(0);
  const sig = sign(null, message(hash, opts.documentId, opts.userId, signedAt), privateKey).toString("base64");
  return db.signature.create({
    data: {
      documentId: opts.documentId,
      signedById: opts.userId,
      method: "DIGITAL",
      certificateSerial: row.fingerprint,
      keyId: row.id,
      contentHash: hash,
      signatureValue: sig,
      signedAt,
    },
  });
}

export type SignatureCheck = {
  id: string;
  signerName: string;
  signedAt: Date;
  fingerprint: string | null;
  status: "VALID" | "TAMPERED" | "INVALID";
  message: string;
};

/** Баримтын бүх цахим гарын үсгийг шалгана: (1) агуулга өөрчлөгдөөгүй эсэх, (2) гарын үсэг жинхэнэ эсэх */
export async function verifyDocumentSignatures(documentId: string): Promise<SignatureCheck[]> {
  const list = await prisma.signature.findMany({
    where: { documentId, method: "DIGITAL" },
    include: { key: true, signedBy: { include: { employee: true } } },
    orderBy: { signedAt: "asc" },
  });
  if (!list.length) return [];
  const currentHash = sha256(await canonicalContent(prisma, documentId));
  return list.map((s) => {
    const signerName = `${s.signedBy.employee.lastName.charAt(0)}.${s.signedBy.employee.firstName}`;
    const base = { id: s.id, signerName, signedAt: s.signedAt, fingerprint: s.certificateSerial };
    if (!s.key || !s.contentHash || !s.signatureValue) return { ...base, status: "INVALID", message: "Гарын үсгийн мэдээлэл дутуу" } as const;
    let authentic = false;
    try {
      authentic = verify(null, message(s.contentHash, documentId, s.signedById, s.signedAt), s.key.publicKey, Buffer.from(s.signatureValue, "base64"));
    } catch {
      authentic = false;
    }
    if (!authentic) return { ...base, status: "INVALID", message: "Гарын үсэг нийтийн түлхүүртэй таарахгүй байна" } as const;
    if (s.contentHash !== currentHash) return { ...base, status: "TAMPERED", message: "Гарын үсэг зурсны дараа баримтын агуулга өөрчлөгдсөн байна" } as const;
    return { ...base, status: "VALID", message: "Агуулга өөрчлөгдөөгүй, гарын үсэг жинхэнэ" } as const;
  });
}
