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
