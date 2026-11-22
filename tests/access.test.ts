// Nuutslaliin tuwshnii handaltiin test (lib/access.ts documentScope)
import { test } from "node:test";
import assert from "node:assert/strict";
import { documentScope } from "../src/lib/access";
import type { CurrentUser } from "../src/lib/auth";

const user = (perms: string[] = []): CurrentUser => ({
  id: "u1", username: "u1", fullName: "u1", initials: "U", employeeId: "e1", positionName: null, departmentId: "dep-hr", departmentName: "HR", roles: [], permissions: new Set(perms),
});

test("document.view_all эрхтэй бол бүх (устгаагүй) баримтыг харна", () => {
  assert.deepEqual(documentScope(user(["document.view_all"])), { isDeleted: false });
});

test("Энгийн хэрэглэгч: Нууц баримтыг зөвхөн оролцогч бол харна", () => {
  const scope = JSON.stringify(documentScope(user()));
  assert.ok(scope.includes('"confidentiality":"NORMAL"'));
  assert.ok(scope.includes('"confidentiality":"INTERNAL","ownerDepartmentId":"dep-hr"'), "Дотоод — зөвхөн өөрийн нэгж");
  assert.ok(!scope.includes("CONFIDENTIAL"), "Нууц баримтад оролцогчоос өөр нөхцөлөөр хандахгүй");
  assert.ok(scope.includes('"createdById":"u1"'));
});
