// Ognoo, ner, shoshgiig neg mayagaar haruulah tuslah funktsuud
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
/** 10.13 helber */
export function fmtShort(d: Date | null | undefined) {
  return d ? parts(d).date.slice(5) : "—";
}

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
export function todayLabel() {
  const now = new Date();
  const wd = new Date(now.toLocaleString("en-US", { timeZone: TZ })).getDay();
  return `${parts(now).date}, ${WEEKDAYS[wd]}`;
}

/** Ulaanbaatariin tsagaar unuudriin 00:00 (UTC ognoo bolgon) — DATE baganatai haritsuulahad */
export function startOfToday() {
  return new Date(`${parts(new Date()).date.replace(/\./g, "-")}T00:00:00.000Z`);
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type PersonName = { lastName: string; firstName: string };
export const shortName = (e: PersonName) => `${e.lastName.charAt(0)}.${e.firstName}`;
/** Ner + alban tushaal — barimt henees irsen ni oilgomjtoi haragdana (hereglegchiin turshiltiin sanal) */
export const personLabel = (e: PersonName & { positionName?: string | null }) =>
  e.positionName ? `${shortName(e)} (${e.positionName})` : shortName(e);
/** Profailiin zurgiin hayag; zuraggui bol null */
export const avatarUrl = (u: { id: string; avatarMime?: string | null; avatarUpdatedAt?: Date | null }) =>
  u.avatarMime ? `/api/avatar/${u.id}?v=${u.avatarUpdatedAt?.getTime() ?? 0}` : null;
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

/** Auditiin bichlegiin newValue (JSON)-iin tulhuuriin ner */
const AUDIT_KEY_LABELS: Record<string, string> = {
  comment: "Тайлбар",
  recipient: "Хүлээн авагч",
  method: "Хэлбэр",
  sentAt: "Илгээсэн огноо",
  receiptRef: "Хүлээн авсан",
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

/** Auditiin obiektiin turul */
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
 * Auditiin newValue-g hun unshihuits «Tulhuur: utga» hos bolgono.
 * ID (…Id, uuid) utgiig haruulahgui — tedgeer ni hereglegchid utga aguulahgui.
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

/** FSh-22: barimt hoorondiin hamaarliin turul (eh barimtaas harahad) */
export const RELATION_TYPES = ["Үндэслэсэн", "Хариу", "Өөрчилсөн", "Хүчингүй болгосон"];
/** Holbogdson (zoriltot) barimtaas harahad hamaarliig esreg utgaar ni unshina */
export const RELATION_INVERSE: Record<string, string> = {
  "Үндэслэсэн": "Үндэслэл болсон",
  "Хариу": "Хариу ирүүлсэн",
  "Өөрчилсөн": "Өөрчлөгдсөн",
  "Хүчингүй болгосон": "Хүчингүй болсон",
};
