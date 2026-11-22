// Dugaarlaltiin helberiin test (lib/numbering.ts — BD-07)
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber } from "../src/lib/numbering";

test("Хэлбэрийн тэмдгийг орлуулна", () => {
  assert.equal(formatNumber("Б/{YY}-{SEQ:3}", { typeCode: "ORDER_B", deptCode: "HR", year: 2026, seq: 7 }), "Б/26-007");
  assert.equal(formatNumber("{TYPE}/{DEPT}/{YYYY}/{SEQ}", { typeCode: "A", deptCode: "ADM", year: 2026, seq: 125 }), "A/ADM/2026/125");
});

test("Дараалал өөр бол дугаар давхардахгүй", () => {
  const set = new Set(Array.from({ length: 500 }, (_, i) => formatNumber("И/{YY}-{SEQ:3}", { typeCode: "", deptCode: "", year: 2026, seq: i + 1 })));
  assert.equal(set.size, 500);
});
