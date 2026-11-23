// Tsahim gariin useg (baiguullagiin dotood): Ed25519 + SHA-256
// - Hereglegch bur uuriin tulhuuriin hostoi. Huwiin tulhuuriig nuuts ugees scrypt-eer gargasan
//   tulhuureer AES-256-GCM shifrlej hadgaldag tul nuuts ugiig dahin oruulahguigeer zurah bolomjgui.
// - Batalsan aguulgiig (garchig, aguulga, talbar, hawsraltiin hesh, dugaar) kanonik JSON bolgoj
//   SHA-256 hesh gargaad ter heshiig zurna. Daraa ni aguulga uurchlugdwul shalgalt amjiltgui bolno.
// - Ene ni itgemjlegdsen gerchilgeenii tuw (CA)-iin gerchilgeetei huuli yosnii toon gariin useg bish.
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
 * Nuuts ugiig shalgaad hereglegchiin huwiin tulhuuriig neene. Tulhuur baihgui bol shineer uusgene.
 * Nuuts ug soligdson (admin sergeesen) bol huuchin tulhuuriig huchingui bolgoj shiniig uusgene —
 * huuchin gariin usguud hadgalsan niitiin tulhuureeree shalgagdsaar baina.
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

/* ---------- Aguulgiin hesh ---------- */

/** Barimtiin batlagdsan aguulgiig togtmol daraalaltai JSON bolgono */
export async function canonicalContent(db: Db, documentId: string, documentNumber?: string | null) {
  const d = await db.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { fieldValues: true, attachments: { select: { id: true, fileName: true, checksumSha256: true } } },
  });
  return canonicalJson({ ...d, documentNumber: documentNumber !== undefined ? documentNumber : d.documentNumber });
}

/** Batlah ued transaction dotor duudagdana */
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
  status: "VALID" | "TAMPERED" | "INVALID" | "REVOKED";
  message: string;
};

/** Barimtiin buh tsahim gariin usgiig shalgana: (1) aguulga uurchlugduugui eseh, (2) gariin useg jinhene eseh */
export async function verifyDocumentSignatures(documentId: string): Promise<SignatureCheck[]> {
  const list = await prisma.signature.findMany({
    where: { documentId, method: "DIGITAL" },
    include: { key: true, signedBy: { include: { employee: true } } },
    orderBy: { signedAt: "asc" },
  });
  if (!list.length) return [];
  // Batlamj tsutslagdsnaas umnu zursan gariin useg huchingui (ustgahgui, tuuhend uldene)
  const lastRevoke = await prisma.auditLog.findFirst({ where: { documentId, action: "REVOKE" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
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
    if (lastRevoke && s.signedAt <= lastRevoke.createdAt) return { ...base, status: "REVOKED", message: "Батламж цуцлагдсан тул энэ гарын үсэг хүчингүй" } as const;
    if (!authentic) return { ...base, status: "INVALID", message: "Гарын үсэг нийтийн түлхүүртэй таарахгүй байна" } as const;
    if (s.contentHash !== currentHash) return { ...base, status: "TAMPERED", message: "Гарын үсэг зурсны дараа баримтын агуулга өөрчлөгдсөн байна" } as const;
    return { ...base, status: "VALID", message: "Агуулга өөрчлөгдөөгүй, гарын үсэг жинхэнэ" } as const;
  });
}
