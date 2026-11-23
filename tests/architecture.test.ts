// Gurwan tuwshnii arhitektur aldagdaagui esehiig shalgana (kodiin butets deer)
//   1. Interfeis  — src/app/**/page.tsx, src/components ("use client" komponentuud)
//   2. Bizness logik — server action (actions.ts) ba src/lib/*
//   3. Ugugdul    — Prisma (src/lib/prisma.ts) → PostgreSQL
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
const files = walk("src").map((f) => ({ f, s: readFileSync(f, "utf8") }));
const WRITE = /\b(prisma|tx)\.\w+\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(|\$transaction|\$executeRaw/;

test("Хэрэглэгчийн талын (client) компонент өгөгдлийн сан, серверийн модульд хандахгүй", () => {
  const client = files.filter((x) => /^\s*["']use client["']/.test(x.s));
  assert.ok(client.length > 0);
  for (const { f, s } of client) {
    assert.ok(!/from\s+["'](@prisma\/client|@\/lib\/prisma)["']/.test(s), `${f}: Prisma импортолсон`);
    assert.ok(!/from\s+["']@\/lib\/(workflow|access|signature|numbering|hr|storage|reports)["']/.test(s), `${f}: бизнес логикийн модуль импортолсон`);
  }
});

test("Хуудас (page.tsx) өгөгдлийн санд бичихгүй, бичилт бизнес логикийн түвшинд хийгдэнэ", () => {
  for (const { f, s } of files.filter((x) => x.f.endsWith("page.tsx"))) assert.ok(!WRITE.test(s), `${f}: хуудаснаас шууд бичилт хийсэн`);
});

test("Төлөвийн шилжилт зөвхөн lib/workflow.ts-ээр дамжина", () => {
  // Shine noorog uusgeh (DRAFT) ees busad statusId oorchlolt workflow.ts-ees gadna baihgui
  const outside = files.filter((x) => !x.f.endsWith("workflow.ts") && /statusId\s*:/.test(x.s));
  for (const { f, s } of outside) assert.ok(/statusId:\s*draft\.id/.test(s) && (s.match(/statusId\s*:/g) ?? []).length === 1, `${f}: төлөвийг workflow-оос гадуур өөрчилсөн`);
});

test("Өгөгдлийн сантай зөвхөн Prisma-аар харьцана (шууд pg драйвергүй)", () => {
  for (const { f, s } of files) assert.ok(!/from\s+["'](pg|postgres|mysql2?)["']/.test(s), `${f}: шууд драйвер`);
  const prismaNew = files.filter((x) => /new PrismaClient\(/.test(x.s)).map((x) => x.f.replace(/\\/g, "/"));
  assert.deepEqual(prismaNew, ["src/lib/prisma.ts"], "PrismaClient зөвхөн нэг газар үүснэ");
});
