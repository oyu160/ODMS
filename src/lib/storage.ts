// Hawsralt failiig ugugdliin san dotor (attachments.content) hadgalna
import "server-only";
import { createHash, randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // FBSh-07: 20 MB
export const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

/** Failiig shalgaj, ugugdliin sand bichih medeelliig beltgene */
export async function saveFile(file: File) {
  if (file.size > MAX_FILE_BYTES) throw new Error("Файлын хэмжээ 20 MB-аас хэтэрсэн байна");
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Зөвхөн PDF, Word, Excel, JPG, PNG файл хавсаргана");

  const buf = Buffer.from(await file.arrayBuffer());
  return {
    fileName: file.name,
    storageKey: `db:${randomUUID()}`, // fail ugugdliin sand baigaag zaana
    mimeType: file.type,
    fileSize: BigInt(file.size),
    checksumSha256: createHash("sha256").update(buf).digest("hex"),
    content: new Uint8Array(buf),
  };
}

/** Hawsraltiin aguulgiig butsaana. Umnu ni diskend hadgalsan huuchin failiig ch unshina. */
export async function loadFile(att: { storageKey: string; content: Uint8Array | null }) {
  if (att.content) return att.content;
  const root = path.join(process.cwd(), "uploads");
  const full = path.resolve(root, att.storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error("Буруу файлын зам");
  return new Uint8Array(await readFile(full));
}
