"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const back = (path: string, msg?: string) => redirect(msg ? `${path}${path.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}` : path);
// Aldaanii medegdel: err= parametreer damjuulj ulaan unguur haruulna
const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);

async function audit(userId: string, entityType: string, entityId: string, newValue: Prisma.InputJsonValue) {
  await writeAudit({ userId, entityType, entityId, action: "SETTINGS", newValue });
}

export async function saveType(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const data = {
    name: s(fd, "name"),
    code: s(fd, "code").toUpperCase(),
    categoryId: s(fd, "categoryId"),
    numberingRuleId: s(fd, "numberingRuleId") || null,
    defaultRetentionYears: s(fd, "retention") ? Number(s(fd, "retention")) : null,
    isActive: fd.get("isActive") === "on",
  };
  if (!data.name || !data.code || !data.categoryId) fail(`/settings?type=${id}`, "Нэр, код, ангиллыг бөглөнө үү");
  try {
    const t = id ? await prisma.documentType.update({ where: { id }, data }) : await prisma.documentType.create({ data });
    await audit(user.id, "document_type", t.id, { name: t.name });
    revalidatePath("/settings");
    back(`/settings?type=${t.id}`, "Хадгаллаа");
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") fail(`/settings?type=${id}`, "Ийм кодтой төрөл бүртгэлтэй байна");
    throw e;
  }
}

export async function saveField(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const typeId = s(fd, "documentTypeId");
  const options = s(fd, "options").split(",").map((x) => x.trim()).filter(Boolean);
  const data = {
    label: s(fd, "label"),
    name: s(fd, "name").toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    dataType: s(fd, "dataType") || "text",
    options: options.length ? options : undefined,
    isRequired: fd.get("isRequired") === "on",
    isActive: id ? fd.get("isActive") === "on" : true,
  };
  if (!data.label || !data.name) fail(`/settings?type=${typeId}`, "Талбарын нэр, кодыг бөглөнө үү");
  try {
    if (id) await prisma.fieldDefinition.update({ where: { id }, data });
    else {
      const max = await prisma.fieldDefinition.aggregate({ where: { documentTypeId: typeId }, _max: { displayOrder: true } });
      await prisma.fieldDefinition.create({ data: { ...data, documentTypeId: typeId, displayOrder: (max._max.displayOrder ?? 0) + 1 } });
    }
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") fail(`/settings?type=${typeId}`, "Ийм кодтой талбар энэ төрөлд байна");
    throw e;
  }
  await audit(user.id, "field_definition", typeId, { field: data.name });
  revalidatePath("/settings");
  back(`/settings?type=${typeId}`, "Талбар хадгалагдлаа");
}

export async function moveField(fd: FormData) {
  await requirePermission("settings.manage");
  const id = s(fd, "id");
  const dir = s(fd, "dir") === "up" ? -1 : 1;
  const f = await prisma.fieldDefinition.findUniqueOrThrow({ where: { id } });
  const list = await prisma.fieldDefinition.findMany({ where: { documentTypeId: f.documentTypeId }, orderBy: { displayOrder: "asc" } });
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j >= 0 && j < list.length) {
    const reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    await prisma.$transaction(reordered.map((x, k) => prisma.fieldDefinition.update({ where: { id: x.id }, data: { displayOrder: k + 1 } })));
  }
  revalidatePath("/settings");
  back(`/settings?type=${f.documentTypeId}`);
}

export async function deleteField(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const f = await prisma.fieldDefinition.findUniqueOrThrow({ where: { id }, include: { _count: { select: { values: true } } } });
  // Utga burtgegdsen talbariig ustgahgui, idewhgui bolgono (tuuh aldagdahgui)
  if (f._count.values > 0) await prisma.fieldDefinition.update({ where: { id }, data: { isActive: false } });
  else await prisma.fieldDefinition.delete({ where: { id } });
  await audit(user.id, "field_definition", f.documentTypeId, { removed: f.name });
  revalidatePath("/settings");
  back(`/settings?type=${f.documentTypeId}`, f._count.values > 0 ? "Утгатай тул идэвхгүй болгов" : "Устгалаа");
}

export async function saveCategory(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const data = { code: s(fd, "code").toUpperCase(), name: s(fd, "name"), isActive: id ? fd.get("isActive") === "on" : true };
  if (!data.code || !data.name) fail("/settings?tab=categories", "Код, нэрийг бөглөнө үү");
  const c = id ? await prisma.documentCategory.update({ where: { id }, data }) : await prisma.documentCategory.create({ data });
  await audit(user.id, "document_category", c.id, { name: c.name });
  revalidatePath("/settings");
  back("/settings?tab=categories", "Хадгаллаа");
}

export async function saveRule(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const data = { pattern: s(fd, "pattern"), resetPeriod: s(fd, "resetPeriod") || "YEARLY", perDepartment: fd.get("perDepartment") === "on" };
  if (!data.pattern.includes("{SEQ")) fail("/settings?tab=numbering", "Хэлбэрт {SEQ} эсвэл {SEQ:3} заавал орно");
  // 3.3.4: uur jil, uur negjid ijil dugaar dawtagdahguin tuld
  if (data.resetPeriod === "YEARLY" && !/\{YYYY\}|\{YY\}/.test(data.pattern))
    fail("/settings?tab=numbering", "Тоологч жил бүр тэглэгдэх тул хэлбэрт {YY} эсвэл {YYYY} заавал орно");
  if (data.perDepartment && !data.pattern.includes("{DEPT}"))
    fail("/settings?tab=numbering", "Нэгжээр тусад нь тоолох тул хэлбэрт {DEPT} заавал орно");
  const r = id ? await prisma.numberingRule.update({ where: { id }, data }) : await prisma.numberingRule.create({ data });
  await audit(user.id, "numbering_rule", r.id, { pattern: r.pattern });
  revalidatePath("/settings");
  back("/settings?tab=numbering", "Хадгаллаа");
}

/** Meta ugugdluur awtomataar chigluuleh durem hadgalah */
export async function saveRoutingRule(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const or = (k: string) => s(fd, k) || null;
  const data = {
    name: s(fd, "name"),
    documentTypeId: or("documentTypeId"),
    confidentiality: or("confidentiality"),
    direction: or("direction"),
    departmentId: or("departmentId"),
    fieldId: or("fieldId"),
    fieldValue: or("fieldValue"),
    reviewerId: s(fd, "reviewerId"),
    priority: Number(s(fd, "priority") || 100),
    isActive: id ? fd.get("isActive") === "on" : true,
  };
  const path = "/settings?tab=routing";
  if (!data.name || !data.reviewerId) fail(path, "Дүрмийн нэр, хянагчийг заавал сонгоно");
  if (!data.documentTypeId && !data.confidentiality && !data.direction && !data.departmentId && !data.fieldId)
    fail(path, "Дор хаяж нэг нөхцөл сонгоно уу");
  if (data.fieldValue && !data.fieldId) fail(path, "Талбарын утга оруулбал талбараа сонгоно уу");
  if (data.fieldId && data.documentTypeId) {
    const f = await prisma.fieldDefinition.findUnique({ where: { id: data.fieldId } });
    if (f && f.documentTypeId !== data.documentTypeId) fail(path, "Сонгосон талбар тухайн баримтын төрөлд хамаарахгүй байна");
  }
  if (!Number.isInteger(data.priority) || data.priority < 1 || data.priority > 999) fail(path, "Эрэмбэ 1–999 хооронд бүхэл тоо байна");
  const reviewer = await prisma.user.findFirst({
    where: { id: data.reviewerId, isActive: true, roles: { some: { role: { permissions: { some: { permission: { code: "document.approve" } } } } } } },
  });
  if (!reviewer) fail(path, "Сонгосон хянагч батлах эрхгүй эсвэл идэвхгүй байна");
  const r = id ? await prisma.routingRule.update({ where: { id }, data }) : await prisma.routingRule.create({ data });
  await audit(user.id, "routing_rule", r.id, { name: r.name });
  revalidatePath("/settings");
  back(path, "Чиглүүлэх дүрэм хадгалагдлаа");
}

export async function deleteRoutingRule(fd: FormData) {
  const user = await requirePermission("settings.manage");
  const id = s(fd, "id");
  const r = await prisma.routingRule.delete({ where: { id } });
  await audit(user.id, "routing_rule", id, { removed: r.name });
  revalidatePath("/settings");
  back("/settings?tab=routing", "Дүрэм устгагдлаа");
}
