// Biznesiin durmiin test (lib/workflow.ts ruleViolation) — ugugdliin sang huurmag obiektoor orluulna
import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleViolation } from "../src/lib/workflow";
import type { CurrentUser } from "../src/lib/auth";

const user = (id: string, perms: string[] = []): CurrentUser => ({
  id, username: id, fullName: id, initials: "XX", employeeId: "e-" + id, positionName: null, departmentId: "dep", departmentName: "dep", roles: [], permissions: new Set(perms),
});
const doc = { id: "d1", statusId: "s", documentTypeId: "t", createdById: "creator", direction: "INTERNAL" };
// approval.findFirst: zuwhun «reviewer» hereglegchid huleegdej bui hyanalt baina
const db = {
  approval: { findFirst: async ({ where }: { where: { reviewerId: string } }) => (where.reviewerId === "reviewer" ? { id: "ap1" } : null) },
  assignment: { findFirst: async () => null },
} as never;

test("БД-05: үүсгэгч өөрийн баримтыг батлах боломжгүй", async () => {
  assert.match((await ruleViolation(db, user("creator", ["document.approve"]), doc, "approve")) ?? "", /БД-05/);
});

test("Хяналт ирээгүй хэрэглэгч батлах боломжгүй", async () => {
  assert.ok(await ruleViolation(db, user("other", ["document.approve"]), doc, "approve"));
});

test("Хяналт хүлээж буй хянагч батална", async () => {
  assert.equal(await ruleViolation(db, user("reviewer", ["document.approve"]), doc, "approve"), null);
});

test("Зөвхөн үүсгэгч хяналтад илгээнэ, ирсэн бичиг хяналтаар явахгүй", async () => {
  assert.ok(await ruleViolation(db, user("other"), doc, "submit"));
  assert.equal(await ruleViolation(db, user("creator"), doc, "submit"), null);
  assert.ok(await ruleViolation(db, user("creator"), { ...doc, direction: "INCOMING" }, "submit"));
});

test("Цуцлах: үүсгэгч эсвэл бүх баримт харах эрхтэй хэрэглэгч", async () => {
  assert.ok(await ruleViolation(db, user("other"), doc, "cancel"));
  assert.equal(await ruleViolation(db, user("boss", ["document.view_all"]), doc, "cancel"), null);
});

test("Явсан бичиг хуваарилагдахгүй, илгээгдсэний дараа архивлагдана", async () => {
  const out = { ...doc, direction: "OUTGOING" };
  const at = (code: string) => ({ ...(db as object), documentStatus: { findUnique: async () => ({ code }) } }) as never;
  assert.equal(await ruleViolation(db, user("records"), out, "send"), null);
  assert.ok(await ruleViolation(db, user("records"), doc, "send"));
  assert.ok(await ruleViolation(db, user("records"), out, "assign"));
  assert.equal(await ruleViolation(db, user("records"), doc, "assign"), null);
  assert.ok(await ruleViolation(at("REGISTERED"), user("records"), out, "archive"));
  assert.equal(await ruleViolation(at("SENT"), user("records"), out, "archive"), null);
});

test("Батламжийг зөвхөн баталсан хүн цуцална", async () => {
  const withApprover = { ...(db as object), approval: { findFirst: async () => ({ reviewerId: "reviewer" }) } } as never;
  assert.equal(await ruleViolation(withApprover, user("reviewer", ["document.approve"]), doc, "revoke"), null);
  assert.ok(await ruleViolation(withApprover, user("other", ["document.approve"]), doc, "revoke"));
});
