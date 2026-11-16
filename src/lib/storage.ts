// Хавсралт файлыг өгөгдлийн сан дотор (attachments.content) хадгална
import "server-only";
import { createHash, randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // ФБШ-07: 20 MB
export const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

/** Файлыг шалгаж, өгөгдлийн санд бичих мэдээллийг бэлтгэнэ */
export async function saveFile(file: File) {
  if (file.size > MAX_FILE_BYTES) throw new Error("Файлын хэмжээ 20 MB-аас хэтэрсэн байна");
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Зөвхөн PDF, Word, Excel, JPG, PNG файл хавсаргана");

  const buf = Buffer.from(await file.arrayBuffer());
  return {
    fileName: file.name,
    storageKey: `db:${randomUUID()}`, // файл өгөгдлийн санд байгааг заана
    mimeType: file.type,
    fileSize: BigInt(file.size),
    checksumSha256: createHash("sha256").update(buf).digest("hex"),
    content: new Uint8Array(buf),
  };
}

/** Хавсралтын агуулгыг буцаана. Өмнө нь дискэнд хадгалсан хуучин файлыг ч уншина. */
export async function loadFile(att: { storageKey: string; content: Uint8Array | null }) {
  if (att.content) return att.content;
  const root = path.join(process.cwd(), "uploads");
  const full = path.resolve(root, att.storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error("Буруу файлын зам");
  return new Uint8Array(await readFile(full));
}
