// Огноо, нэр, шошгыг нэг маягаар харуулах туслах функцууд
export const TZ = "Asia/Ulaanbaatar";

function parts(d: Date) {
  const s = d.toLocaleString("sv-SE", { timeZone: TZ }); // 2026-10-15 16:20:00
  return { date: s.slice(0, 10).replace(/-/g, "."), time: s.slice(11, 16) };
}

export function fmtDate(d: Date | null | undefined) {
  return d ? parts(d).date : "—";
}
export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  const p = parts(d);
  return `${p.date} ${p.time}`;
}
/** 10.13 хэлбэр */
export function fmtShort(d: Date | null | undefined) {
  return d ? parts(d).date.slice(5) : "—";
}

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
export function todayLabel() {
  const now = new Date();
  const wd = new Date(now.toLocaleString("en-US", { timeZone: TZ })).getDay();
  return `${parts(now).date}, ${WEEKDAYS[wd]}`;
}

/** Улаанбаатарын цагаар өнөөдрийн 00:00 (UTC огноо болгон) — DATE баганатай харьцуулахад */
export function startOfToday() {
  return new Date(`${parts(new Date()).date.replace(/\./g, "-")}T00:00:00.000Z`);
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type PersonName = { lastName: string; firstName: string };
export const shortName = (e: PersonName) => `${e.lastName.charAt(0)}.${e.firstName}`;
export const initials = (e: PersonName) => `${e.lastName.charAt(0)}${e.firstName.charAt(0)}`.toUpperCase();

export const DIRECTION_LABELS: Record<string, string> = { INTERNAL: "Дотоод", INCOMING: "Ирсэн", OUTGOING: "Явсан" };
export const CONF_LABELS: Record<string, string> = { NORMAL: "Энгийн", INTERNAL: "Дотоод", CONFIDENTIAL: "Нууц" };
export const DECISION_LABELS: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  APPROVED: "Баталсан",
  RETURNED: "Засварт буцаасан",
  FORWARDED: "Дараагийн хянагч руу шилжүүлсэн",
  CANCELLED: "Цуцлагдсан",
};
export const ASSIGNMENT_LABELS: Record<string, string> = { ACTIVE: "Хуваарилагдсан", DONE: "Шийдвэрлэгдсэн", REASSIGNED: "Дахин хуваарилсан" };
export const DATA_TYPE_LABELS: Record<string, string> = {
  text: "Бичвэр",
  textarea: "Урт бичвэр",
  number: "Тоо",
  date: "Огноо",
  select: "Сонголт",
  employee: "Ажилтны сонголт",
  department: "Нэгж",
};

export function fileSize(bytes: number | bigint) {
  const n = Number(bytes);
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;
}

/** Аудитын бичлэгийн newValue (JSON)-ийн түлхүүрийн нэр */
const AUDIT_KEY_LABELS: Record<string, string> = {
  comment: "Тайлбар",
  routing: "Чиглүүлэлт",
  number: "Дугаар",
  signature: "Гарын үсэг",
  step: "Шат",
  assignee: "Хариуцагч",
  dueDate: "Хугацаа",
  version: "Хувилбар",
  changed: "Өөрчилсөн",
  removed: "Хассан",
  removedFiles: "Хассан файл",
  report: "Тайлан",
  rows: "Мөр",
  roles: "Үүрэг",
  pairs: "Эрхийн хослол",
  created: "Нэмсэн",
  updated: "Шинэчилсэн",
  deactivated: "Идэвхгүй болгосон",
  name: "Нэр",
  code: "Код",
  field: "Талбар",
  pattern: "Хэлбэр",
  departments: "Нэгж",
  added: "Шинэ ажилтан",
  left: "Ажлаас гарсан",
  deactivatedUsers: "Хаагдсан эрх",
  relationType: "Хамаарал",
  target: "Холбосон баримт",
  decision: "Шийдвэр",
  note: "Тэмдэглэл",
};

/** Аудитын объектын төрөл */
export const ENTITY_LABELS: Record<string, string> = {
  document: "Баримт",
  user: "Хэрэглэгч",
  report: "Тайлан",
  assignment: "Хуваарилалт",
  field_definition: "Маягтын талбар",
  routing_rule: "Чиглүүлэх дүрэм",
  role_permission: "Эрх",
  document_type: "Баримтын төрөл",
  document_category: "Ангилал",
  numbering_rule: "Дугаарлалт",
  hr_sync: "HR синхрончлол",
  document_relation: "Баримтын хамаарал",
  archive: "Архив",
};

/**
 * Аудитын newValue-г хүн уншихуйц «Түлхүүр: утга» хос болгоно.
 * ID (…Id, uuid) утгыг харуулахгүй — тэдгээр нь хэрэглэгчид утга агуулахгүй.
 */
export function describeAuditValue(value: unknown): { label: string; value: string }[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object" || Array.isArray(value)) return [{ label: "Утга", value: String(value) }];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return Object.entries(value as Record<string, unknown>)
    .filter(([k, v]) => !k.endsWith("Id") && !(typeof v === "string" && uuid.test(v)) && v !== null && v !== "")
    .map(([k, v]) => ({
      label: AUDIT_KEY_LABELS[k] ?? k,
      value: Array.isArray(v) ? v.join(", ") : typeof v === "object" ? Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a}: ${b}`).join(", ") : String(v),
    }));
}

/** ФШ-22: баримт хоорондын хамаарлын төрөл (эх баримтаас харахад) */
export const RELATION_TYPES = ["Үндэслэсэн", "Хариу", "Өөрчилсөн", "Хүчингүй болгосон"];
/** Холбогдсон (зорилтот) баримтаас харахад хамаарлыг эсрэг утгаар нь уншина */
export const RELATION_INVERSE: Record<string, string> = {
  "Үндэслэсэн": "Үндэслэл болсон",
  "Хариу": "Хариу ирүүлсэн",
  "Өөрчилсөн": "Өөрчлөгдсөн",
  "Хүчингүй болгосон": "Хүчингүй болсон",
};
