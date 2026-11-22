// Meta ugugdluur awtomataar chigluuleh durmiin test (lib/routing.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRule, ruleMatches, type RuleLike, type DocMeta } from "../src/lib/routing";

const T_ORDER_B = "type-order-b";
const T_CONTRACT = "type-contract";
const F_KIND = "field-order-kind";

const rule = (p: Partial<RuleLike> & { id: string; reviewerId: string }): RuleLike => ({
  name: p.id, documentTypeId: null, confidentiality: null, direction: null, departmentId: null, fieldId: null, fieldValue: null, priority: 100, ...p,
});
const doc = (p: Partial<DocMeta> = {}): DocMeta => ({
  documentTypeId: T_ORDER_B, confidentiality: "INTERNAL", direction: "INTERNAL", ownerDepartmentId: "dep-hr", createdById: "u-creator", fields: [], ...p,
});

const RULES = [
  rule({ id: "secret", reviewerId: "u-director", confidentiality: "CONFIDENTIAL", priority: 10 }),
  rule({ id: "order-b", reviewerId: "u-hr-head", documentTypeId: T_ORDER_B, priority: 20 }),
  rule({ id: "contract", reviewerId: "u-fin-head", documentTypeId: T_CONTRACT, priority: 30 }),
  rule({ id: "outgoing", reviewerId: "u-adm-head", direction: "OUTGOING", priority: 90 }),
];

test("Төрлөөр чиглүүлнэ: Тушаал (Б) → Хүний нөөцийн дарга", () => {
  assert.equal(pickRule(RULES, doc())?.reviewerId, "u-hr-head");
});

test("Эрэмбэ бага дүрэм түрүүлнэ: нууц Тушаал (Б) → Захирал", () => {
  assert.equal(pickRule(RULES, doc({ confidentiality: "CONFIDENTIAL" }))?.id, "secret");
});

test("Тохирох дүрэм байхгүй бол null (хэрэглэгч гараар сонгоно)", () => {
  assert.equal(pickRule(RULES, doc({ documentTypeId: "type-memo" })), null);
});

test("БД-05: дүрмийн хянагч нь үүсгэгч өөрөө бол дараагийн дүрэм рүү шилжинэ", () => {
  const r = pickRule(RULES, doc({ createdById: "u-hr-head", direction: "OUTGOING" }));
  assert.equal(r?.id, "outgoing");
  assert.equal(pickRule(RULES, doc({ createdById: "u-hr-head" })), null);
});

test("Ижил эрэмбэтэй бол илүү олон нөхцөлтэй дүрэм түрүүлнэ", () => {
  const rules = [
    rule({ id: "general", reviewerId: "a", documentTypeId: T_ORDER_B, priority: 50 }),
    rule({ id: "specific", reviewerId: "b", documentTypeId: T_ORDER_B, confidentiality: "INTERNAL", priority: 50 }),
  ];
  assert.equal(pickRule(rules, doc())?.id, "specific");
});

test("Талбарын утгаар (том жижиг үсэг, зай үл хамаарна)", () => {
  const r = rule({ id: "dismiss", reviewerId: "u-legal", fieldId: F_KIND, fieldValue: "Чөлөөлөх" });
  assert.ok(ruleMatches(r, doc({ fields: [{ fieldId: F_KIND, valueText: "  чөлөөлөх " }] })));
  assert.ok(!ruleMatches(r, doc({ fields: [{ fieldId: F_KIND, valueText: "Томилох" }] })));
  assert.ok(!ruleMatches(r, doc()), "талбар бөглөөгүй бол таарахгүй");
});

test("Хоосон нөхцөл нь «ямар ч» гэсэн утгатай, бүх нөхцөл зэрэг биелэх ёстой", () => {
  const r = rule({ id: "x", reviewerId: "z", documentTypeId: T_ORDER_B, departmentId: "dep-fin" });
  assert.ok(!ruleMatches(r, doc()));
  assert.ok(ruleMatches(r, doc({ ownerDepartmentId: "dep-fin" })));
});
