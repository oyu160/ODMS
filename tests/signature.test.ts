// Цахим гарын үсгийн тест (lib/signature-core.ts): түлхүүр шифрлэлт, зурах, өөрчлөлт илрүүлэх
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify, createHash } from "crypto";
import { sealPrivateKey, openPrivateKey, fingerprintOf, sha256, signingMessage, canonicalJson, type CanonicalDoc } from "../src/lib/signature-core";

const base: CanonicalDoc = {
  id: "11111111-1111-1111-1111-111111111111",
  internalNumber: "Д-0125",
  documentNumber: "Б/26-014",
  documentTypeId: "type-order-b",
  title: "Ажилтан томилох тухай",
  summary: "Д.Төгөлдөрийг програм хангамжийн инженерээр томилсугай.",
  direction: "INTERNAL",
  confidentiality: "INTERNAL",
  documentDate: new Date("2026-11-15T00:00:00Z"),
  fieldValues: [{ fieldId: "f2", valueText: "Томилох" }, { fieldId: "f1", valueText: "Хөдөлмөрийн тухай хууль" }],
  attachments: [{ id: "a1", fileName: "tushaal.pdf", checksumSha256: createHash("sha256").update("pdf-bytes").digest("hex") }],
};

function keys(password: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const sealed = sealPrivateKey(privateKey.export({ format: "der", type: "pkcs8" }), password);
  return { pem, sealed };
}

test("Хувийн түлхүүрийг зөвхөн зөв нууц үгээр нээнэ", () => {
  const { sealed } = keys("Passw0rd!");
  assert.doesNotThrow(() => openPrivateKey(sealed, "Passw0rd!"));
  assert.throws(() => openPrivateKey(sealed, "buruu-nuuts-ug"));
});

test("Зурсан гарын үсэг нийтийн түлхүүрээр баталгаажна, өөр хүний түлхүүрээр үгүй", () => {
  const a = keys("pw-a");
  const b = keys("pw-b");
  const at = new Date("2026-11-15T10:00:00Z");
  const msg = signingMessage(sha256(canonicalJson(base)), base.id, "user-a", at);
  const sig = sign(null, msg, openPrivateKey(a.sealed, "pw-a"));
  assert.ok(verify(null, msg, a.pem, sig));
  assert.ok(!verify(null, msg, b.pem, sig));
  assert.equal(fingerprintOf(a.pem).length, 16);
});

test("Гарын үсгийг өөр баримт, өөр хэрэглэгч, өөр цагт дахин ашиглах боломжгүй", () => {
  const a = keys("pw");
  const at = new Date("2026-11-15T10:00:00Z");
  const hash = sha256(canonicalJson(base));
  const sig = sign(null, signingMessage(hash, base.id, "user-a", at), openPrivateKey(a.sealed, "pw"));
  assert.ok(!verify(null, signingMessage(hash, "other-doc", "user-a", at), a.pem, sig));
  assert.ok(!verify(null, signingMessage(hash, base.id, "user-b", at), a.pem, sig));
  assert.ok(!verify(null, signingMessage(hash, base.id, "user-a", new Date("2026-11-16T10:00:00Z")), a.pem, sig));
});

test("Агуулга өөрчлөгдвөл хэш өөрчлөгдөж, өөрчлөлт илэрнэ", () => {
  const h = sha256(canonicalJson(base));
  assert.notEqual(sha256(canonicalJson({ ...base, title: base.title + "." })), h, "гарчиг");
  assert.notEqual(sha256(canonicalJson({ ...base, summary: "Өөр агуулга" })), h, "агуулга");
  assert.notEqual(sha256(canonicalJson({ ...base, documentNumber: "Б/26-015" })), h, "дугаар");
  assert.notEqual(sha256(canonicalJson({ ...base, fieldValues: [{ fieldId: "f2", valueText: "Чөлөөлөх" }, base.fieldValues[1]] })), h, "талбар");
  const swapped = { ...base.attachments[0], checksumSha256: createHash("sha256").update("oor-fail").digest("hex") };
  assert.notEqual(sha256(canonicalJson({ ...base, attachments: [swapped] })), h, "хавсралтын файл солигдсон");
});

test("Талбар, хавсралтын дараалал хэшид нөлөөлөхгүй (каноник хэлбэр)", () => {
  const h = sha256(canonicalJson(base));
  assert.equal(sha256(canonicalJson({ ...base, fieldValues: [...base.fieldValues].reverse() })), h);
});
