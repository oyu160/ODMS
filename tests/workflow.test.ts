// Бизнесийн дүрмийн тест (lib/workflow.ts ruleViolation) — өгөгдлийн санг хуурмаг объектоор орлуулна
import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleViolation } from "../src/lib/workflow";
import type { CurrentUser } from "../src/lib/auth";

const user = (id: string, perms: string[] = []): CurrentUser => ({
  id, username: id, fullName: id, initials: "XX", employeeId: "e-" + id, positionName: null, departmentId: "dep", departmentName: "dep", roles: [], permissions: new Set(perms),
});
const doc = { id: "d1", statusId: "s", documentTypeId: "t", createdById: "creator", direction: "INTERNAL" };
// approval.findFirst: зөвхөн «reviewer» хэрэглэгчид хүлээгдэж буй хяналт байна
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
