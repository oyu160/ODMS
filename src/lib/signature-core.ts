// Tsahim gariin usgiin kriptografiin tsum (ugugdliin sangaas hamaaralgui — testlehed hyalbar)
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, randomBytes, scryptSync } from "crypto";

/* ---------- Tulhuuriin shifrlelt ---------- */

export function sealPrivateKey(pkcs8: Buffer, password: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(pkcs8), c.final()]);
  return [salt, iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function openPrivateKey(sealed: string, password: string) {
  const [salt, iv, tag, enc] = sealed.split(".").map((x) => Buffer.from(x, "base64"));
  const key = scryptSync(password, salt, 32);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  const der = Buffer.concat([d.update(enc), d.final()]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function fingerprintOf(publicKeyPem: string) {
  const der = createPublicKey(publicKeyPem).export({ format: "der", type: "spki" });
  return createHash("sha256").update(der).digest("hex").slice(0, 16).toUpperCase();
}

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Zurah messej: aguulgiin hesh + barimt + zursan hun + tsag (dahin ashiglahaas sergiilne) */
export const signingMessage = (hash: string, documentId: string, userId: string, signedAt: Date) => Buffer.from(`${hash}|${documentId}|${userId}|${signedAt.toISOString()}`, "utf8");


export type CanonicalDoc = {
  id: string;
  internalNumber: string;
  documentNumber: string | null;
  documentTypeId: string;
  title: string;
  summary: string | null;
  direction: string;
  confidentiality: string;
  documentDate: Date | null;
  fieldValues: { fieldId: string; valueText: string }[];
  attachments: { id: string; fileName: string; checksumSha256: string }[];
};

/** Batlagdsan aguulgiig togtmol daraalaltai JSON bolgono (talbar, hawsraltiig ID-aar erembelne) */
export function canonicalJson(d: CanonicalDoc) {
  return JSON.stringify({
    id: d.id,
    internalNumber: d.internalNumber,
    documentNumber: d.documentNumber,
    documentTypeId: d.documentTypeId,
    title: d.title,
    summary: d.summary ?? null,
    direction: d.direction,
    confidentiality: d.confidentiality,
    documentDate: d.documentDate ? d.documentDate.toISOString().slice(0, 10) : null,
    fields: d.fieldValues.map((f) => [f.fieldId, f.valueText]).sort((a, b) => a[0].localeCompare(b[0])),
    attachments: d.attachments.map((a) => [a.id, a.fileName, a.checksumSha256]).sort((a, b) => a[0].localeCompare(b[0])),
  });
}
