// FBSh-06 guitsetgeliin hemjilt: ugugdliin sand niit 10 000 barimt boltol turshiltiin barimt nemj,
// barimtiin jagsaalt, hailtiin hariu uguh hugatsaag hemjine.
//   npm run perf            — barimt nemeed hemjine (ur dun: perf-result.json, perf-result.md)
//   npm run perf -- --clean — turshiltaar nemsen barimtuudiig (PERF-) ustgana
// `npm run dev` ajillaj baiwal huudasnii buten hariu (HTTP) hugatsaag mun hemjine.
import { PrismaClient, type Prisma } from "@prisma/client";
import { writeFile } from "fs/promises";
import { performance } from "perf_hooks";
import { buildWhere, type DocFilter } from "../src/lib/document-filters";
import { encryptSession, SESSION_COOKIE } from "../src/lib/session";
import type { CurrentUser } from "../src/lib/auth";

const prisma = new PrismaClient();
const TARGET = 10_000;
const RUNS = 20;
const BASE = process.env.PERF_BASE_URL ?? "http://localhost:3000";

const WORDS = ["төсөв", "журам", "ажилтан", "томилох", "сургалт", "гэрээ", "тайлан", "хурал", "төлөвлөгөө", "худалдан авалт", "шагнал", "чөлөөлөх", "амралт", "тооллого", "аюулгүй ажиллагаа", "цахим", "архив", "хөрөнгө", "тендер", "үнэлгээ"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function generate() {
  const existing = await prisma.document.count();
  const need = TARGET - existing;
  if (need <= 0) return { existing, added: 0 };
  const [types, statuses, depts, users] = await Promise.all([
    prisma.documentType.findMany({ include: { fields: { where: { dataType: { in: ["text", "select"] } }, take: 1 } } }),
    prisma.documentStatus.findMany(),
    prisma.department.findMany({ where: { isActive: true } }),
    prisma.user.findMany({ where: { isActive: true }, include: { employee: true } }),
  ]);
  const confs = ["NORMAL", "NORMAL", "NORMAL", "INTERNAL", "INTERNAL", "CONFIDENTIAL"];
  const start = (await prisma.document.count({ where: { internalNumber: { startsWith: "PERF-" } } })) + 1;
  const now = Date.now();
  for (let off = 0; off < need; off += 1000) {
    const batch: Prisma.DocumentCreateManyInput[] = [];
    const values: { internalNumber: string; fieldId: string; valueText: string }[] = [];
    for (let k = off; k < Math.min(need, off + 1000); k++) {
      const t = pick(types);
      const u = pick(users);
      const st = pick(statuses);
      const n = start + k;
      const internalNumber = `PERF-${String(n).padStart(5, "0")}`;
      batch.push({
        internalNumber,
        documentTypeId: t.id,
        documentNumber: ["DRAFT", "IN_REVIEW", "RETURNED"].includes(st.code) ? null : `П/${String(n).padStart(5, "0")}`,
        title: `${pick(WORDS)} ${pick(WORDS)}-ийн тухай (${n})`,
        summary: `${pick(WORDS)}, ${pick(WORDS)}, ${pick(WORDS)} асуудлаарх туршилтын баримт`,
        direction: pick(["INTERNAL", "INTERNAL", "OUTGOING", "INCOMING"]),
        confidentiality: pick(confs),
        statusId: st.id,
        ownerDepartmentId: u.employee.departmentId ?? pick(depts).id,
        createdById: u.id,
        createdAt: new Date(now - Math.floor(Math.random() * 365) * 86_400_000),
      });
      if (t.fields[0]) values.push({ internalNumber, fieldId: t.fields[0].id, valueText: pick(WORDS) });
    }
    await prisma.document.createMany({ data: batch });
    const ids = new Map((await prisma.document.findMany({ where: { internalNumber: { in: values.map((v) => v.internalNumber) } }, select: { id: true, internalNumber: true } })).map((d) => [d.internalNumber, d.id]));
    await prisma.documentFieldValue.createMany({ data: values.map((v) => ({ documentId: ids.get(v.internalNumber)!, fieldId: v.fieldId, valueText: v.valueText })) });
    process.stdout.write(`  ${Math.min(need, off + 1000)}/${need} баримт нэмэв\r`);
  }
  await prisma.$executeRawUnsafe("ANALYZE");
  return { existing, added: need };
}

async function asUser(username: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { username },
    include: { employee: { include: { department: true } }, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  return {
    id: u.id, username: u.username, fullName: u.employee.firstName, initials: "", employeeId: u.employeeId, positionName: u.employee.positionName,
    departmentId: u.employee.departmentId, departmentName: u.employee.department.name, roles: u.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
    permissions: new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))),
  };
}

/** Barimtiin jagsaaltiin huudastai ijil asuulga: niit too + 10 mur (src/app/(main)/documents/page.tsx) */
async function listQuery(user: CurrentUser, f: DocFilter, page = 1) {
  const where = buildWhere(user, f);
  await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 10, take: 10,
      include: { status: true, documentType: true, createdBy: { include: { employee: true } }, attachments: { where: { isMain: true }, take: 1, omit: { content: true } } },
    }),
  ]);
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  return { median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) };
};
async function measure(fn: () => Promise<unknown>) {
  for (let i = 0; i < 3; i++) await fn(); // halaalt
  const xs: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    await fn();
    xs.push(performance.now() - t);
  }
  return stats(xs);
}

async function main() {
  if (process.argv.includes("--clean")) {
    const ids = (await prisma.document.findMany({ where: { internalNumber: { startsWith: "PERF-" } }, select: { id: true } })).map((d) => d.id);
    await prisma.documentFieldValue.deleteMany({ where: { documentId: { in: ids } } });
    const r = await prisma.document.deleteMany({ where: { id: { in: ids } } });
    console.log(`Туршилтын ${r.count} баримт устгав`);
    return;
  }
  console.log("1) Туршилтын баримт нэмж байна…");
  const gen = await generate();
  const total = await prisma.document.count();
  console.log(`\n   Нийт баримт: ${total} (өмнө ${gen.existing}, нэмсэн ${gen.added})`);

  const boss = await asUser(process.env.PERF_ADMIN_USER ?? "sukhbat"); // document.view_all
  const staff = await asUser(process.env.PERF_STAFF_USER ?? "employee"); // nuutslaliin hureegeer shuugdene
  const anyType = (await prisma.documentType.findFirstOrThrow({ where: { code: "ORDER_B" } })).id;

  const cases: [string, () => Promise<unknown>][] = [
    ["Жагсаалт, эхний хуудас (бүх баримт харах эрхтэй)", () => listQuery(boss, {})],
    ["Жагсаалт, эхний хуудас (энгийн ажилтан, нууцлалын шүүлттэй)", () => listQuery(staff, {})],
    ["Жагсаалт, 500 дахь хуудас", () => listQuery(boss, {}, 500)],
    ["Түлхүүр үгээр хайх ('томилох')", () => listQuery(boss, { q: "томилох" })],
    ["Түлхүүр үгээр хайх, энгийн ажилтан ('гэрээ')", () => listQuery(staff, { q: "гэрээ" })],
    ["Дугаараар хайх ('П/0123')", () => listQuery(boss, { q: "П/0123" })],
    ["Хайлт + төрөл + төлөв + огнооны шүүлтүүр", () => listQuery(boss, { q: "тайлан", type: anyType, status: "ARCHIVED", from: "2026-01-01", to: "2026-12-31" })],
  ];
  console.log(`2) Өгөгдлийн сангийн асуулга (${RUNS} удаа, мс):`);
  const db: Record<string, ReturnType<typeof stats>> = {};
  for (const [name, fn] of cases) {
    db[name] = await measure(fn);
    console.log(`   ${name}: дундаж ${db[name].median}, 95% ${db[name].p95}, хамгийн их ${db[name].max}`);
  }

  // Huudasnii buten hariu (serwer ajillaj baiwal): newtersen hereglegchiin kuukitei GET huselt
  const http: Record<string, ReturnType<typeof stats>> = {};
  try {
    const cookie = `${SESSION_COOKIE}=${await encryptSession({ userId: boss.id, username: boss.username })}`;
    const pages: [string, string][] = [
      ["/documents", "Баримтын жагсаалт хуудас"],
      ["/documents?q=%D1%82%D0%BE%D0%BC%D0%B8%D0%BB%D0%BE%D1%85", "Хайлтын үр дүнгийн хуудас ('томилох')"],
      [`/documents?q=%D1%82%D0%B0%D0%B9%D0%BB%D0%B0%D0%BD&type=${anyType}&status=ARCHIVED`, "Хайлт + шүүлтүүрийн хуудас"],
    ];
    await fetch(BASE + "/documents", { headers: { cookie } }); // ehnii hurwuulelt
    for (const [path, name] of pages) {
      http[name] = await measure(async () => {
        const r = await fetch(BASE + path, { headers: { cookie } });
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        await r.text();
      });
    }
    console.log(`3) Хуудасны бүтэн хариу (HTTP, ${BASE}):`);
    for (const [k, v] of Object.entries(http)) console.log(`   ${k}: дундаж ${v.median}, 95% ${v.p95}, хамгийн их ${v.max}`);
  } catch (e) {
    console.log(`3) HTTP хэмжилт алгасав (${(e as Error).message}). npm run dev ажиллуулаад дахин оролдоно уу.`);
  }

  const env = { node: process.version, platform: `${process.platform} ${process.arch}`, pg: ((await prisma.$queryRawUnsafe("SHOW server_version")) as { server_version: string }[])[0].server_version, mode: process.env.NODE_ENV ?? "development" };
  const result = { measuredAt: new Date().toISOString(), totalDocuments: total, runs: RUNS, env, database: db, http, limitMs: 2000 };
  await writeFile("perf-result.json", JSON.stringify(result, null, 2));
  const md = [`# Гүйцэтгэлийн хэмжилт (${result.measuredAt})`, `Нийт баримт: ${total}; удаа: ${RUNS}; Node ${env.node}; PostgreSQL ${env.pg}`, "", "| Тохиолдол | Дундаж (мс) | 95% (мс) | Хамгийн их (мс) |", "|---|---|---|---|",
    ...Object.entries({ ...db, ...http }).map(([k, v]) => `| ${k} | ${v.median} | ${v.p95} | ${v.max} |`)].join("\n");
  await writeFile("perf-result.md", md + "\n");
  const worst = Math.max(...Object.values({ ...db, ...http }).map((v) => v.p95));
  console.log(`\nДүгнэлт: хамгийн удаан тохиолдлын 95% нь ${worst} мс — шаардлага (2000 мс) ${worst <= 2000 ? "ХАНГАСАН" : "ХАНГААГҮЙ"}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
