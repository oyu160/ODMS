// Anhnii bolon turshiltiin ugugdul
// Ajilluulah: npx prisma db seed
// ANHAAR: barimt, huwaarilalt, audit zereg guilgeenii ugugdliig buren tsewerleed dahin uusgene.
import { PrismaClient, type Prisma, type ApprovalDecision } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { seedRoutingRules } from "./routing-rules";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const NOW = Date.now();

// ── Togtmol sanamsargui too (seed burt ijil ur dun) ──
let rngState = 20261016;
function rnd() {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

// ═════════════ 1. Erh, uureg, tuluw ═════════════
const PERMISSIONS: [string, string][] = [
  ["document.create", "Баримт үүсгэх"],
  ["document.view_all", "Бүх баримт харах"],
  ["document.submit", "Хяналтад илгээх"],
  ["document.review", "Хянах, засварт буцаах"],
  ["document.approve", "Батлах"],
  ["document.register", "Бүртгэх, дугаар олгох"],
  ["document.assign", "Хуваарилах, дахин хуваарилах"],
  ["document.resolve", "Шийдвэрлэх"],
  ["document.archive", "Архивлах"],
  ["document.cancel", "Цуцлах"],
  ["report.view", "Тайлан харах"],
  ["settings.manage", "Баримтын тохиргоо удирдах"],
  ["user.manage", "Хэрэглэгч, эрх удирдах"],
  ["audit.view", "Аудитын бүртгэл харах"],
];

const ROLES: { code: string; name: string; perms: string[] }[] = [
  { code: "ADMIN", name: "Админ", perms: ["settings.manage", "user.manage", "audit.view", "report.view", "document.view_all"] },
  {
    code: "RECORDS_OFFICER",
    name: "Баримт бичгийн ажилтан",
    perms: ["document.create", "document.view_all", "document.submit", "document.register", "document.assign", "document.archive", "document.cancel", "document.resolve", "report.view"],
  },
  { code: "MANAGER", name: "Удирдлага", perms: ["document.create", "document.view_all", "document.submit", "document.review", "document.approve", "document.assign", "document.resolve", "document.cancel", "report.view"] },
  { code: "UNIT_STAFF", name: "Хэлтэс/нэгжийн ажилтан", perms: ["document.create", "document.submit", "document.resolve", "document.cancel"] },
  { code: "EMPLOYEE", name: "Энгийн ажилтан", perms: ["document.resolve"] },
];

const STATUSES: [string, string, boolean][] = [
  ["DRAFT", "Ноорог", false],
  ["IN_REVIEW", "Хяналтад", false],
  ["RETURNED", "Засварт буцаасан", false],
  ["APPROVED", "Батлагдсан", false],
  ["REGISTERED", "Бүртгэгдсэн", false],
  ["ASSIGNED", "Хуваарилагдсан", false],
  ["RESOLVED", "Шийдвэрлэгдсэн", false],
  ["ARCHIVED", "Архивлагдсан", true],
  ["CANCELLED", "Цуцлагдсан", true],
];

const TRANSITIONS: [string, string, string, string][] = [
  ["DRAFT", "IN_REVIEW", "submit", "document.submit"],
  ["DRAFT", "REGISTERED", "register_incoming", "document.register"],
  ["IN_REVIEW", "APPROVED", "approve", "document.approve"],
  ["IN_REVIEW", "RETURNED", "return", "document.review"],
  ["RETURNED", "IN_REVIEW", "resubmit", "document.submit"],
  ["APPROVED", "REGISTERED", "register", "document.register"],
  ["REGISTERED", "ASSIGNED", "assign", "document.assign"],
  ["ASSIGNED", "ASSIGNED", "reassign", "document.assign"],
  ["ASSIGNED", "RESOLVED", "resolve", "document.resolve"],
  ["REGISTERED", "ARCHIVED", "archive", "document.archive"],
  ["RESOLVED", "ARCHIVED", "archive", "document.archive"],
  ["DRAFT", "CANCELLED", "cancel", "document.cancel"],
  ["RETURNED", "CANCELLED", "cancel", "document.cancel"],
  ["IN_REVIEW", "IN_REVIEW", "forward", "document.approve"], // olon shatlalt hyanalt: daraagiin hyanagch ruu
  ["IN_REVIEW", "CANCELLED", "cancel", "document.cancel"], // hyanagch tsutslah (shaltgaantai)
];

// ═════════════ 2. Baiguullagiin butets (HR sistemiin ugugdultei ijil) ═════════════
const DEPARTMENTS: [string, string][] = [
  ["MGMT", "Удирдлага"],
  ["ADM", "Захиргааны хэлтэс"],
  ["FIN", "Санхүү, эдийн засгийн хэлтэс"],
  ["HR", "Хүний нөөцийн алба"],
  ["IT", "Мэдээллийн технологийн хэлтэс"],
  ["LEGAL", "Хууль, эрх зүйн хэлтэс"],
  ["PLAN", "Төлөвлөлт, бодлогын хэлтэс"],
  ["AUDIT", "Дотоод аудитын алба"],
  ["PR", "Олон нийттэй харилцах алба"],
  ["PROC", "Худалдан авах ажиллагааны алба"],
];

// [kod, owog, ner, alban tushaal, negj, newtreh ner | null, uureg]
const PEOPLE: [string, string, string, string, string, string | null, string][] = [
  ["E001", "Төмөр", "Ганбат", "Системийн админ", "IT", "admin", "ADMIN"],
  ["E002", "Нямдорж", "Номин", "Архив, бичиг хэргийн ажилтан", "ADM", "records", "RECORDS_OFFICER"],
  ["E003", "Сүхбаатар", "Энхтуяа", "Захиргааны хэлтсийн дарга", "ADM", "manager", "MANAGER"],
  ["E004", "Батсүх", "Бат-Эрдэнэ", "Хүний нөөцийн мэргэжилтэн", "HR", "unit", "UNIT_STAFF"],
  ["E005", "Дорж", "Төгөлдөр", "Програм хангамжийн инженер", "IT", "employee", "EMPLOYEE"],
  ["E006", "Баатар", "Сүхбат", "Хүний нөөцийн албаны дарга", "HR", "sukhbat", "MANAGER"],
  ["E007", "Жаргал", "Оюун", "Санхүүгийн хэлтсийн дарга", "FIN", "oyun", "MANAGER"],
  ["E008", "Очир", "Анужин", "Мэргэжилтэн", "ADM", "anujin", "UNIT_STAFF"],
  ["E009", "Ганзориг", "Тэмүүлэн", "Бичиг хэргийн ажилтан", "ADM", "temuulen", "RECORDS_OFFICER"],
  ["E010", "Гантулга", "Сарнай", "Нягтлан бодогч", "FIN", "sarnai", "UNIT_STAFF"],
  ["E011", "Дашдорж", "Отгонбаяр", "Хуулийн зөвлөх", "LEGAL", "otgonbayar", "UNIT_STAFF"],
  ["E012", "Лхагва", "Мөнхзул", "Бодлого төлөвлөлтийн мэргэжилтэн", "PLAN", "munkhzul", "UNIT_STAFF"],
  ["E013", "Пүрэв", "Ариунаа", "Сүлжээний инженер", "IT", "ariunaa", "EMPLOYEE"],
  ["E014", "Цэрэн", "Болормаа", "Ня-бо", "FIN", "bolormaa", "EMPLOYEE"],
  ["E015", "Энхбаяр", "Тэмүүжин", "Төлөвлөлт, бодлогын хэлтсийн дарга", "PLAN", "temuujin", "MANAGER"],
  ["E016", "Батбаяр", "Хулан", "Хуулийн мэргэжилтэн", "LEGAL", "khulan", "EMPLOYEE"],
  ["E017", "Мягмар", "Золзаяа", "Захиргааны ажилтан", "ADM", "zolzaya", "EMPLOYEE"],
  ["E018", "Ганхуяг", "Билгүүн", "Мэдээллийн аюулгүй байдлын мэргэжилтэн", "IT", "bilguun", "EMPLOYEE"],
  ["E019", "Нямсүрэн", "Уянга", "Хүний нөөцийн ажилтан", "HR", "uyanga", "EMPLOYEE"],
  ["E020", "Баярсайхан", "Эрдэнэ", "Гүйцэтгэх захирал", "MGMT", "director", "MANAGER"],
  ["E021", "Ширнэн", "Гэрэл", "Дадлагажигч", "PLAN", null, "EMPLOYEE"],
  ["E022", "Алтанхуяг", "Мөнх-Очир", "Жолооч", "ADM", null, "EMPLOYEE"],
];

// ── Nemelt ajiltnuud (bodit baiguullagiin hemjeend oirtuulah) ──
const LAST = ["Батболд", "Ганболд", "Энхбаатар", "Мөнхбат", "Цогтбаяр", "Даваасүрэн", "Пүрэвдорж", "Оюунбилэг", "Төмөрбаатар", "Сэргэлэн", "Баярмагнай", "Нарантуяа", "Отгонбаатар", "Алтангэрэл", "Чинзориг", "Лхагвасүрэн", "Ганзул", "Эрдэнэбат", "Батжаргал", "Цэцэгмаа"];
const FIRST = ["Анар", "Билэгт", "Дөлгөөн", "Есүй", "Жавхлан", "Зоригт", "Ингэрэл", "Лхамаа", "Марал", "Наран", "Одгэрэл", "Пагма", "Саруул", "Тэнүүн", "Уянга", "Халиун", "Цэлмэг", "Чимэг", "Энхжин", "Ялалт", "Мишээл", "Номуун", "Хангай", "Солонго", "Тэмүүлэн", "Мөнхжин", "Ариун", "Бямбаа", "Гэрэлт", "Дэлгэр"];
const POS: Record<string, [string, string][]> = {
  ADM: [["Мэргэжилтэн", "UNIT_STAFF"], ["Бичиг хэргийн ажилтан", "EMPLOYEE"], ["Аж ахуйн ажилтан", "EMPLOYEE"], ["Нарийн бичиг", "EMPLOYEE"]],
  FIN: [["Ахлах нягтлан бодогч", "UNIT_STAFF"], ["Нягтлан бодогч", "EMPLOYEE"], ["Эдийн засагч", "EMPLOYEE"], ["Кассир", "EMPLOYEE"]],
  HR: [["Сургалтын мэргэжилтэн", "UNIT_STAFF"], ["Хүний нөөцийн ажилтан", "EMPLOYEE"]],
  IT: [["Ахлах инженер", "UNIT_STAFF"], ["Програм хангамжийн инженер", "EMPLOYEE"], ["Техник үйлчилгээний ажилтан", "EMPLOYEE"]],
  LEGAL: [["Хуулийн мэргэжилтэн", "UNIT_STAFF"], ["Гэрээний мэргэжилтэн", "EMPLOYEE"]],
  PLAN: [["Бодлогын шинжээч", "UNIT_STAFF"], ["Статистикч", "EMPLOYEE"], ["Төслийн менежер", "EMPLOYEE"]],
  AUDIT: [["Аудитын албаны дарга", "MANAGER"], ["Дотоод аудитор", "UNIT_STAFF"], ["Аудитор", "EMPLOYEE"]],
  PR: [["Олон нийттэй харилцах албаны дарга", "MANAGER"], ["Хэвлэлийн төлөөлөгч", "UNIT_STAFF"], ["Контент бүтээгч", "EMPLOYEE"]],
  PROC: [["Худалдан авах албаны дарга", "MANAGER"], ["Худалдан авалтын мэргэжилтэн", "UNIT_STAFF"], ["Нярав", "EMPLOYEE"]],
};
const COUNTS: Record<string, number> = { ADM: 7, FIN: 6, HR: 4, IT: 6, LEGAL: 3, PLAN: 5, AUDIT: 4, PR: 4, PROC: 4 };
const LAT: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya" };
const latin = (x: string) => x.toLowerCase().split("").map((c) => LAT[c] ?? (/[a-z0-9]/.test(c) ? c : "")).join("");
{
  const used = new Set(PEOPLE.map((p) => p[5]).filter(Boolean));
  let n = PEOPLE.length + 1;
  for (const [dept, cnt] of Object.entries(COUNTS)) {
    const roles = POS[dept];
    for (let k = 0; k < cnt; k++) {
      // Tuhain negjid darga baihgui bol ehnii hun ni darga bolno
      const [pos, role] = k < roles.length ? roles[k] : roles[roles.length - 1];
      const ln = LAST[(n * 7) % LAST.length], fn = FIRST[(n * 11) % FIRST.length];
      let un = latin(fn);
      while (used.has(un)) un = `${latin(fn)}${(n % 9) + 1}${used.size % 7}`;
      used.add(un);
      const noAccess = pos === "Нярав" || pos === "Аж ахуйн ажилтан";
      PEOPLE.push([`E${String(n).padStart(3, "0")}`, ln, fn, pos, dept, noAccess ? null : un, role]);
      n++;
    }
  }
}

// ═════════════ 3. Barimtiin turul ═════════════
type FieldSeed = { name: string; label: string; dataType: string; isRequired?: boolean; options?: string[] };
type TypeSeed = { code: string; name: string; cat: string; pattern: string; years: number; fields: FieldSeed[]; titles: string[]; weight: number; flow: "review" | "incoming" };

const CATEGORIES: [string, string][] = [
  ["ADMIN_ORDER", "Захирамжлалын баримт"],
  ["ORGANIZATIONAL", "Зохион байгуулалтын баримт"],
  ["INFORMATIONAL", "Мэдээлэл лавлагааны баримт"],
  ["CONTRACTS", "Гэрээ, хэлэлцээр"],
];

const TYPES: TypeSeed[] = [
  {
    code: "ORDER_A", name: "Тушаал (А)", cat: "ADMIN_ORDER", pattern: "А/{YY}-{SEQ:3}", years: 75, weight: 10, flow: "review",
    fields: [
      { name: "order_basis", label: "Тушаалын үндэслэл", dataType: "text", isRequired: true },
      { name: "effective_date", label: "Хүчин төгөлдөр болох огноо", dataType: "date", isRequired: true },
    ],
    titles: ["{Y} оны сургалтын төлөвлөгөө батлах тухай", "Ажлын хэсэг байгуулах тухай", "Дотоод журамд өөрчлөлт оруулах тухай", "{Y} оны {Q}-р улирлын төсвийн гүйцэтгэлийг хангах тухай", "Эрүүл мэндийн үзлэг зохион байгуулах тухай", "Тоног төхөөрөмж худалдан авах тухай", "Цахим шилжилтийн хөтөлбөр батлах тухай", "Ажлын цагийн хуваарь батлах тухай", "Тооллогын комисс байгуулах тухай", "Аюулгүй ажиллагааны зааврыг мөрдүүлэх тухай", "Шагналын журам батлах тухай", "Албан томилолтоор ажиллуулах тухай", "Байгууллагын бүтэц, орон тоог батлах тухай", "Нийтээр амрах баярын өдрүүдийн ажлын зохион байгуулалтын тухай", "{Y} оны үйл ажиллагааны төлөвлөгөө батлах тухай", "Гамшгаас хамгаалах дадлага сургууль зохион байгуулах тухай"],
  },
  {
    code: "ORDER_B", name: "Тушаал (Б)", cat: "ADMIN_ORDER", pattern: "Б/{YY}-{SEQ:3}", years: 75, weight: 10, flow: "review",
    fields: [
      { name: "order_basis", label: "Тушаалын үндэслэл", dataType: "text", isRequired: true },
      { name: "employee", label: "Хамаарах ажилтан", dataType: "employee", isRequired: true },
      { name: "order_kind", label: "Тушаалын төрөл", dataType: "select", isRequired: true, options: ["Томилох", "Чөлөөлөх", "Шилжүүлэх", "Ээлжийн амралт олгох", "Шагнах"] },
      { name: "position", label: "Томилох албан тушаал", dataType: "text" },
      { name: "effective_date", label: "Хүчин төгөлдөр болох огноо", dataType: "date", isRequired: true },
    ],
    titles: ["Ажилтан томилох тухай", "Ээлжийн амралт олгох тухай", "Ажилтныг шилжүүлэх тухай", "Ажлаас чөлөөлөх тухай", "Ажилтныг шагнах тухай", "Туршилтын хугацаатай томилох тухай"],
  },
  {
    code: "DECISION", name: "Шийдвэр", cat: "ADMIN_ORDER", pattern: "Ш/{YY}-{SEQ:3}", years: 75, weight: 4, flow: "review",
    fields: [{ name: "basis", label: "Үндэслэл", dataType: "text", isRequired: true }],
    titles: ["{Y} оны төсвийг батлах тухай", "Хурлын тогтоол хэрэгжүүлэх тухай", "Үйлчилгээний үнэ тариф шинэчлэх тухай", "Хөрөнгө оруулалтын төлөвлөгөө батлах тухай", "Урамшуулал олгох тухай"],
  },
  {
    code: "RULE", name: "Журам", cat: "ORGANIZATIONAL", pattern: "Ж/{YY}-{SEQ:3}", years: 10, weight: 4, flow: "review",
    fields: [{ name: "approved_by", label: "Баталсан тушаалын дугаар", dataType: "text" }, { name: "scope", label: "Хамрах хүрээ", dataType: "select", options: ["Бүх ажилтан", "Удирдлага", "Тодорхой нэгж"] }],
    titles: ["Баримт бичиг хөтлөх журам", "Дотоод ажлын журам", "Мэдээллийн аюулгүй байдлын журам", "Албан томилолтын журам", "Цалин хөлсний журам", "Худалдан авах ажиллагааны журам", "Сахилгын журам", "Цахим шуудан ашиглах журам", "Архивын баримт ашиглуулах журам"],
  },
  {
    code: "ACT", name: "Акт", cat: "ORGANIZATIONAL", pattern: "АКТ/{YY}-{SEQ:3}", years: 10, weight: 3, flow: "review",
    fields: [{ name: "commission", label: "Комиссын бүрэлдэхүүн", dataType: "text" }],
    titles: ["Эд хөрөнгө актлах тухай", "{Y} оны тооллогын акт", "Ажил хүлээлцсэн акт", "Тоног төхөөрөмж хүлээлгэн өгсөн акт", "Архивт шилжүүлэх баримтын акт"],
  },
  {
    code: "INCOMING", name: "Ирсэн албан бичиг", cat: "INFORMATIONAL", pattern: "И/{YY}-{SEQ:3}", years: 10, weight: 24, flow: "incoming",
    fields: [
      { name: "sender_org", label: "Илгээгч байгууллага", dataType: "text", isRequired: true },
      { name: "sender_number", label: "Илгээгчийн дугаар", dataType: "text" },
      { name: "reply_due", label: "Хариу өгөх хугацаа", dataType: "date" },
    ],
    titles: ["Мэдээлэл ирүүлэх тухай", "Санал авах тухай", "{Y} оны {Q}-р улирлын төсвийн гүйцэтгэлийн мэдээ", "Хамтран ажиллах тухай", "{M}-р сарын тайлан ирүүлэх тухай", "Уулзалтад урих тухай", "Ажлын хэсэгт төлөөлөл оролцуулах тухай", "Хяналт шалгалт хийх тухай", "Сургалтад хамруулах тухай", "Албан хүсэлт", "Хуулийн төсөлд санал авах тухай", "Статистик мэдээ гаргуулах тухай", "Үзлэг, шалгалтын дүнгийн тухай", "Иргэний өргөдлийг шилжүүлэх тухай", "Зөвлөмж хүргүүлэх тухай", "Арга хэмжээний удирдамж"],
  },
  {
    code: "OUTGOING", name: "Явсан албан бичиг", cat: "INFORMATIONAL", pattern: "З/{YY}-{SEQ:3}", years: 10, weight: 14, flow: "review",
    fields: [
      { name: "recipient_org", label: "Хүлээн авагч байгууллага", dataType: "text", isRequired: true },
      { name: "reply_to", label: "Хариу өгч буй бичгийн дугаар", dataType: "text" },
    ],
    titles: ["Санал хүргүүлэх тухай", "Мэдээлэл хүргүүлэх тухай", "Хариу хүргүүлэх тухай", "{M}-р сарын тайлан хүргүүлэх тухай", "Хүсэлт гаргах тухай", "Төлөөлөл томилсон тухай", "{Y} оны {Q}-р улирлын гүйцэтгэл хүргүүлэх тухай", "Хамтран ажиллах санал хүргүүлэх тухай", "Албан талархал илэрхийлэх тухай"],
  },
  {
    code: "CERT", name: "Тодорхойлолт", cat: "INFORMATIONAL", pattern: "ТД/{YY}-{SEQ:3}", years: 3, weight: 6, flow: "review",
    fields: [{ name: "employee", label: "Хамаарах ажилтан", dataType: "employee", isRequired: true }, { name: "purpose", label: "Зориулалт", dataType: "select", options: ["Банк", "Элчин сайдын яам", "Сургууль", "Бусад"] }],
    titles: ["Ажил эрхэлж буйг тодорхойлох", "Цалингийн тодорхойлолт", "Ажилласан жилийн тодорхойлолт"],
  },
  {
    code: "MEMO", name: "Илтгэх хуудас", cat: "INFORMATIONAL", pattern: "ИХ/{YY}-{SEQ:3}", years: 5, weight: 6, flow: "review",
    fields: [{ name: "proposal", label: "Санал болгож буй шийдвэр", dataType: "textarea" }],
    titles: ["Ажлын байрны нөхцөл сайжруулах тухай", "Программ хангамж шинэчлэх тухай", "Нэмэлт төсөв хүсэх тухай", "Сургалтад хамрагдах тухай", "Албан тасалгааны засварын тухай", "Серверийн багтаамж нэмэгдүүлэх тухай", "Орон тоо нэмэх тухай"],
  },
  {
    code: "CONTRACT", name: "Гэрээ", cat: "CONTRACTS", pattern: "Г/{YY}-{SEQ:3}", years: 10, weight: 6, flow: "review",
    fields: [
      { name: "party", label: "Гэрээлэгч тал", dataType: "text", isRequired: true },
      { name: "amount", label: "Гэрээний дүн (₮)", dataType: "number" },
      { name: "end_date", label: "Дуусах огноо", dataType: "date" },
    ],
    titles: ["Ажил гүйцэтгэх гэрээ", "Бараа нийлүүлэх гэрээ", "Үйлчилгээний гэрээ", "Хамтын ажиллагааны санамж бичиг", "Түрээсийн гэрээ", "Програм хангамжийн лицензийн гэрээ", "Харуул хамгаалалтын гэрээ", "Цэвэрлэгээний үйлчилгээний гэрээ"],
  },
];

const ORGS = ["Засгийн газрын Хэрэгжүүлэгч агентлаг", "Төрийн албаны зөвлөл", "Үндэсний аудитын газар", "Сангийн яам", "Татварын ерөнхий газар", "Нийслэлийн Засаг даргын тамгын газар", "Үндэсний статистикийн хороо", "Шилэн дансны газар", "Мэдээлэл, харилцаа холбооны яам", "Хөдөлмөр, нийгмийн хамгааллын яам", "Нийгмийн даатгалын ерөнхий газар", "Улсын бүртгэлийн ерөнхий газар", "Монголбанк"];
const PARTIES = ["Номин трейд ХХК", "Юнител ХХК", "Мобиком ХХК", "Ди Си Эс ХХК", "Тэнгэр даатгал ХХК", "Голомт банк", "Оффис плас ХХК"];
const RETURN_REASONS = ["Үндэслэлийг тодруулж, хуулийн заалтыг нэмнэ үү.", "Огноог хөдөлмөрийн гэрээтэй ижил болгоно уу.", "Хавсралтын хувилбар буруу байна.", "Гарчгийг албан бичгийн стандартад нийцүүлнэ үү.", "Санхүүгийн хэлтсийн санал шаардлагатай."];
const RESULTS = ["Хариу хүргүүлсэн.", "Мэдээллийг бэлтгэж илгээсэн.", "Шаардлагатай арга хэмжээ авч хэрэгжүүлсэн.", "Танилцаж, холбогдох нэгжид үүрэг өгсөн.", "Саналыг нэгтгэн хүргүүлсэн."];

// ═════════════ Tuslah funktsuud ═════════════
function minimalPdf(text: string) {
  const content = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
const dateOnly = (t: number) => new Date(new Date(t).toISOString().slice(0, 10) + "T00:00:00.000Z");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

async function main() {
  // ── Erh ──
  const perm: Record<string, string> = {};
  for (const [code, name] of PERMISSIONS) perm[code] = (await prisma.permission.upsert({ where: { code }, update: { name }, create: { code, name } })).id;

  const role: Record<string, string> = {};
  for (const r of ROLES) {
    const row = await prisma.role.upsert({ where: { code: r.code }, update: { name: r.name }, create: { code: r.code, name: r.name } });
    role[r.code] = row.id;
    await prisma.rolePermission.deleteMany({ where: { roleId: row.id } });
    await prisma.rolePermission.createMany({ data: r.perms.map((p) => ({ roleId: row.id, permissionId: perm[p] })) });
  }

  const st: Record<string, string> = {};
  for (const [i, [code, name, isFinal]] of STATUSES.entries()) {
    st[code] = (await prisma.documentStatus.upsert({ where: { code }, update: { name, isFinal, displayOrder: i + 1 }, create: { code, name, isFinal, displayOrder: i + 1 } })).id;
  }

  // ── Guilgeenii ugugdliig tsewerleh ──
  await prisma.notification.deleteMany();
  // audit_logs-iin hamgaalaltiin trigger zuwhun ene guilgeend ustgahiig zuwshuurnu (db-extras.sql)
  await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`,
    prisma.auditLog.deleteMany(),
    prisma.signature.deleteMany(), // gariin usgiin hamgaalaltiin trigger (migration 20261115100000)
  ]);
  await prisma.archive.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.documentRelation.deleteMany();
  await prisma.documentEmployee.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.documentFieldValue.deleteMany();
  await prisma.document.deleteMany();
  await prisma.numberSequence.deleteMany();
  await prisma.statusTransition.deleteMany();

  await prisma.statusTransition.createMany({ data: TRANSITIONS.map(([f, t, a, p]) => ({ fromStatusId: st[f], toStatusId: st[t], actionCode: a, permissionId: perm[p] })) });

  // ── Negj, ajiltan, hereglegch ──
  const dep: Record<string, string> = {};
  for (const [code, name] of DEPARTMENTS) dep[code] = (await prisma.department.upsert({ where: { code }, update: { name, hrRefId: code, isActive: true }, create: { code, name, hrRefId: code } })).id;
  for (const [code] of DEPARTMENTS.filter(([c]) => c !== "MGMT")) await prisma.department.update({ where: { code }, data: { parentId: dep.MGMT } });

  const hash = await bcrypt.hash("Passw0rd!", 10);
  const emp: Record<string, { id: string; userId?: string; dept: string; roleCode: string; name: string }> = {};
  for (const [code, lastName, firstName, positionName, d, username, r] of PEOPLE) {
    const e = await prisma.employee.upsert({
      where: { code },
      update: { lastName, firstName, positionName, departmentId: dep[d], employmentStatus: "ACTIVE", email: username ? `${username}@org.mn` : null, syncedAt: new Date(NOW - DAY) },
      create: { code, lastName, firstName, positionName, departmentId: dep[d], employmentStatus: "ACTIVE", email: username ? `${username}@org.mn` : null, syncedAt: new Date(NOW - DAY) },
    });
    emp[code] = { id: e.id, dept: d, roleCode: r, name: `${lastName.charAt(0)}.${firstName}` };
    if (username) {
      const u = await prisma.user.upsert({ where: { employeeId: e.id }, update: { username, isActive: true, passwordHash: hash }, create: { username, employeeId: e.id, passwordHash: hash } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.userRole.create({ data: { userId: u.id, roleId: role[r] } });
      emp[code].userId = u.id;
    }
  }
  // Huuchin seed-ees uldsen hereglegchdiig idewhgui bolgono
  await prisma.user.updateMany({ where: { username: { notIn: PEOPLE.map((p) => p[5]).filter((x): x is string => !!x) } }, data: { isActive: false } });

  const U = (code: string) => emp[code].userId!;
  const usersBy = (roleCode: string) => PEOPLE.filter((p) => p[5] && p[6] === roleCode).map((p) => p[0]);

  // ── Angilal, dugaarlalt, turul ──
  const cat: Record<string, string> = {};
  for (const [code, name] of CATEGORIES) cat[code] = (await prisma.documentCategory.upsert({ where: { code }, update: { name, isActive: true }, create: { code, name } })).id;

  // Hereglegdehgui bolson huuchin turluudiig ustgah
  const keep = TYPES.map((t) => t.code);
  await prisma.fieldDefinition.deleteMany({ where: { documentType: { code: { notIn: keep } } } });
  await prisma.documentType.deleteMany({ where: { code: { notIn: keep } } });
  await prisma.documentCategory.deleteMany({ where: { code: { notIn: CATEGORIES.map((c) => c[0]) }, types: { none: {} } } });

  const typeRow: Record<string, { id: string; ruleId: string; fields: Record<string, string>; seed: TypeSeed }> = {};
  for (const t of TYPES) {
    let rule = await prisma.numberingRule.findFirst({ where: { pattern: t.pattern } });
    if (!rule) rule = await prisma.numberingRule.create({ data: { pattern: t.pattern, resetPeriod: "YEARLY", perDepartment: false } });
    const row = await prisma.documentType.upsert({
      where: { code: t.code },
      update: { name: t.name, categoryId: cat[t.cat], numberingRuleId: rule.id, defaultRetentionYears: t.years, isActive: true },
      create: { code: t.code, name: t.name, categoryId: cat[t.cat], numberingRuleId: rule.id, defaultRetentionYears: t.years },
    });
    const fields: Record<string, string> = {};
    for (const [i, f] of t.fields.entries()) {
      const fd = await prisma.fieldDefinition.upsert({
        where: { documentTypeId_name: { documentTypeId: row.id, name: f.name } },
        update: { label: f.label, dataType: f.dataType, isRequired: f.isRequired ?? false, options: f.options, displayOrder: i + 1, isActive: true },
        create: { documentTypeId: row.id, name: f.name, label: f.label, dataType: f.dataType, isRequired: f.isRequired ?? false, options: f.options, displayOrder: i + 1 },
      });
      fields[f.name] = fd.id;
    }
    typeRow[t.code] = { id: row.id, ruleId: rule.id, fields, seed: t };
  }
  await prisma.numberingRule.deleteMany({ where: { types: { none: {} } } });

  // ═════════════ 4. Turshiltiin barimtuud ═════════════
  const withUser = PEOPLE.filter((p) => p[5]);
  const recordsOfficers = withUser.filter((p) => p[6] === "RECORDS_OFFICER").map((p) => p[0]);
  const creatorsReview = withUser.filter((p) => p[6] === "UNIT_STAFF" || p[6] === "RECORDS_OFFICER").map((p) => p[0]);
  const assignees = withUser.filter((p) => p[6] === "UNIT_STAFF" || p[6] === "EMPLOYEE").map((p) => p[0]);
  const headOf: Record<string, string> = {};
  for (const p of withUser) if (p[6] === "MANAGER" && !headOf[p[4]]) headOf[p[4]] = p[0];
  // Hyanagch: hunii nuutsiin barimtiig HN-iin darga, sanhuugiinhiig sanhuugiin darga, busdiig uusgegchiin negjiin darga
  const reviewerFor = (typeCode: string, creator: string) => {
    const dept = emp[creator].dept;
    const pref = typeCode === "ORDER_B" || typeCode === "CERT" ? headOf.HR : typeCode === "CONTRACT" || typeCode === "DECISION" ? headOf.FIN : headOf[dept] ?? headOf.ADM;
    return !pref || pref === creator ? "E020" : pref;
  };
  const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const decorate = (title: string, t: number) => {
    const d = new Date(t);
    const q = Math.floor(d.getMonth() / 3) + 1;
    return title.replace("{Y}", String(d.getFullYear())).replace("{Q}", String(q)).replace("{M}", MONTHS[d.getMonth()]);
  };

  type Ev = { t: number; user: string; action: string; to?: string; value?: Prisma.InputJsonValue };
  type Plan = {
    type: string; title: string; creator: string; createdAt: number; direction: string; target: string;
    events: Ev[]; approvals: { reviewer: string; decision: ApprovalDecision; comment?: string; at?: number; step: number }[];
    assignments: { userCode?: string; dept?: string; by: string; at: number; due: number; status: string; done?: number; note?: string }[];
    numberAt?: number; approvedAt?: number; registeredAt?: number; archive?: { by: string; at: number; years: number; location: string; disposal: string };
    fieldValues: Record<string, string>; versions: number; summary: string;
  };
  const plans: Plan[] = [];

  function targetFor(age: number, flow: "review" | "incoming") {
    if (flow === "incoming") {
      if (age < 4) return weighted([["DRAFT", 1], ["REGISTERED", 3], ["ASSIGNED", 4]]);
      if (age < 30) return weighted([["REGISTERED", 1], ["ASSIGNED", 6], ["RESOLVED", 5]]);
      return weighted([["ASSIGNED", 1], ["RESOLVED", 6], ["ARCHIVED", 4]]);
    }
    if (age < 5) return weighted([["DRAFT", 3], ["IN_REVIEW", 5], ["RETURNED", 1]]);
    if (age < 25) return weighted([["IN_REVIEW", 2], ["RETURNED", 1], ["APPROVED", 1], ["REGISTERED", 3], ["ASSIGNED", 3], ["RESOLVED", 2], ["CANCELLED", 0.4]]);
    return weighted([["REGISTERED", 1], ["ASSIGNED", 1], ["RESOLVED", 5], ["ARCHIVED", 4], ["CANCELLED", 0.3]]);
  }

  const N = 650;
  for (let i = 0; i < N; i++) {
    const tCode = weighted(TYPES.map((t) => [t.code, t.weight] as [string, number]));
    const t = typeRow[tCode].seed;
    // Suuliin udruuded iluu olon barimt uusne
    const age = Math.pow(rnd(), 1.15) * 360 + 0.2;
    const createdAt = NOW - age * DAY - between(0, 8) * 3600_000;
    const creator = t.flow === "incoming" ? pick(recordsOfficers) : tCode === "OUTGOING" ? pick(["E002", "E009", "E008", "E011"]) : pick(creatorsReview);
    const target = targetFor(age, t.flow);
    const p: Plan = {
      type: tCode, title: decorate(pick(t.titles), createdAt), creator, createdAt, direction: t.flow === "incoming" ? "INCOMING" : tCode === "OUTGOING" ? "OUTGOING" : "INTERNAL", target,
      events: [{ t: createdAt, user: creator, action: "CREATE", to: "DRAFT" }], approvals: [], assignments: [], fieldValues: {}, versions: 1, summary: "",
    };
    let clock = createdAt;
    const step = (minH: number, maxH: number) => {
      clock = Math.min(clock + between(minH, maxH) * 3600_000, NOW - 600_000);
      return clock;
    };

    if (t.flow === "incoming") {
      if (target !== "DRAFT") {
        p.numberAt = p.registeredAt = step(0.2, 3);
        p.events.push({ t: p.registeredAt, user: creator, action: "REGISTER_INCOMING", to: "REGISTERED" });
      }
    } else if (target !== "DRAFT") {
      if (target === "CANCELLED" && rnd() < 0.5) {
        p.events.push({ t: step(2, 30), user: creator, action: "CANCEL", to: "CANCELLED", value: { comment: "Шаардлагагүй болсон" } });
      } else {
        const reviewer = reviewerFor(tCode, creator);
        p.events.push({ t: step(1, 20), user: creator, action: "SUBMIT", to: "IN_REVIEW" });
        const returned = target === "RETURNED" || target === "CANCELLED" || rnd() < 0.22;
        if (returned) {
          const reason = pick(RETURN_REASONS);
          const at = step(3, 30);
          p.approvals.push({ reviewer, decision: "RETURNED", comment: reason, at, step: 1 });
          p.events.push({ t: at, user: reviewer, action: "RETURN", to: "RETURNED", value: { comment: reason } });
          if (target === "CANCELLED") p.events.push({ t: step(2, 24), user: creator, action: "CANCEL", to: "CANCELLED" });
          else if (target !== "RETURNED") {
            p.versions = 2;
            p.events.push({ t: step(2, 30), user: creator, action: "UPDATE", value: { version: 2 } });
            p.events.push({ t: step(0.1, 1), user: creator, action: "RESUBMIT", to: "IN_REVIEW" });
          }
        }
        if (!["IN_REVIEW", "RETURNED", "CANCELLED"].includes(target)) {
          const at = step(2, 40);
          p.approvals.push({ reviewer, decision: "APPROVED", at, step: p.approvals.length + 1 });
          p.numberAt = p.approvedAt = at;
          p.events.push({ t: at, user: reviewer, action: "APPROVE", to: "APPROVED" });
          if (target !== "APPROVED") {
            p.registeredAt = step(0.5, 20);
            p.events.push({ t: p.registeredAt, user: pick(recordsOfficers), action: "REGISTER", to: "REGISTERED" });
          }
        } else if (target === "IN_REVIEW") {
          p.approvals.push({ reviewer, decision: "PENDING", step: p.approvals.length + 1 });
        }
      }
    }

    // Huwaarilalt ba shiidwerlelt
    const needsAssign = ["ASSIGNED", "RESOLVED"].includes(target) || (target === "ARCHIVED" && (t.flow === "incoming" || rnd() < 0.4));
    if (needsAssign) {
      const by = t.flow === "incoming" || rnd() < 0.6 ? pick(recordsOfficers) : "E003";
      const at = step(1, 30);
      const toDept = rnd() < 0.2;
      const userCode = toDept ? undefined : pick(assignees);
      const dept = toDept ? pick(["FIN", "HR", "IT", "LEGAL", "PLAN"]) : undefined;
      let due = at + between(4, 14) * DAY;
      // Idewhtei huwaarilaltiin ihenh ni hugatsaandaa baina, tsuun ni hetersen
      if (target === "ASSIGNED" && rnd() < 0.65) due = Math.max(due, NOW + between(1, 10) * DAY);
      const a = { userCode, dept, by, at, due, status: "ACTIVE" as string, done: undefined as number | undefined, note: undefined as string | undefined };
      p.assignments.push(a);
      p.events.push({ t: at, user: by, action: "ASSIGN", to: "ASSIGNED", value: { assignee: userCode ? emp[userCode].name : DEPARTMENTS.find((d) => d[0] === dept)![1], dueDate: iso(due) } });
      if (target !== "ASSIGNED") {
        const late = rnd() < 0.18;
        const done = Math.min(late ? due + between(1, 5) * DAY : at + (due - at) * between(0.2, 0.95), NOW - 3600_000);
        clock = Math.max(clock, done);
        a.status = "DONE";
        a.done = done;
        a.note = pick(RESULTS);
        const resolver = userCode ?? PEOPLE.find((x) => x[4] === dept && x[5])?.[0] ?? by;
        p.events.push({ t: done, user: resolver, action: "RESOLVE", to: "RESOLVED", value: { comment: a.note } });
      }
    }
    if (target === "ARCHIVED") {
      const at = step(5, 200);
      p.archive = { by: pick(recordsOfficers), at, years: t.years, location: `Архив ${1 + Math.floor(rnd() * 3)}-р тавиур, хайрцаг ${1 + Math.floor(rnd() * 40)}`, disposal: t.years >= 75 ? "TRANSFER" : "DESTROY" };
      p.events.push({ t: at, user: p.archive.by, action: "ARCHIVE", to: "ARCHIVED" });
    }

    // Talbariin utga
    for (const f of t.fields) {
      let v = "";
      if (f.dataType === "employee") v = emp[pick(PEOPLE.slice(0, 20).map((x) => x[0]))].id;
      else if (f.dataType === "select") v = pick(f.options!);
      else if (f.dataType === "date") v = iso(createdAt + between(3, 40) * DAY);
      else if (f.dataType === "number") v = String(Math.round(between(2, 90)) * 1_000_000);
      else if (f.name === "sender_org" || f.name === "recipient_org") v = pick(ORGS);
      else if (f.name === "sender_number") v = `${Math.floor(between(1, 9))}/${Math.floor(between(100, 999))}`;
      else if (f.name === "party") v = pick(PARTIES);
      else if (f.name.includes("basis")) v = pick(["Хөдөлмөрийн тухай хуулийн 48 дугаар зүйл", "Төрийн албаны тухай хуулийн 27.1", "Байгууллагын дүрмийн 5.3", "ТУЗ-ийн хурлын тогтоол"]);
      else if (f.name === "position") v = pick(["Нягтлан бодогч", "Мэргэжилтэн", "Ахлах мэргэжилтэн", "Хэлтсийн дарга"]);
      else v = pick(["Бүх ажилтан", "Комисс: 3 гишүүн", "А/045", "Санал болгож буй шийдвэрийг дэмжих"]);
      p.fieldValues[f.name] = v;
    }
    if (p.fieldValues.employee) {
      const e = Object.values(emp).find((x) => x.id === p.fieldValues.employee);
      if (e) p.title = tCode === "ORDER_B" ? `${p.fieldValues.order_kind ?? "Томилох"} тухай (${e.name})` : `${p.title} (${e.name})`;
    }
    p.summary = `${p.title} — ${t.name.toLowerCase()}. ${t.flow === "incoming" ? `${p.fieldValues.sender_org ?? ""}-аас ирүүлсэн.` : "Холбогдох нэгжүүдэд танилцуулж, хэрэгжилтийг хангуулна."}`;
    plans.push(p);
  }

  // Huuchin arhiw (hadgalah hugatsaa duussan / duusah gej bui) — arhiwiin hyanaltiig haruulah
  const legacy: [string, string, number][] = [
    ["INCOMING", "Мэдээлэл ирүүлэх тухай (2016)", 3650 + 200],
    ["OUTGOING", "Тайлан хүргүүлэх тухай (2016)", 3650 + 20],
    ["CONTRACT", "Хангамжийн гэрээ (2015)", 3650 + 400],
  ];
  for (const [tCode, title, archivedAgo] of legacy) {
    const at = NOW - (archivedAgo - 0) * DAY - (tCode === "OUTGOING" ? -40 * DAY : 0);
    const createdAt = at - 30 * DAY;
    const t = typeRow[tCode].seed;
    plans.push({
      type: tCode, title, creator: "E002", createdAt, direction: tCode === "INCOMING" ? "INCOMING" : tCode === "OUTGOING" ? "OUTGOING" : "INTERNAL", target: "ARCHIVED",
      events: [{ t: createdAt, user: "E002", action: "CREATE", to: "DRAFT" }, { t: createdAt + DAY, user: "E002", action: "REGISTER_INCOMING", to: "REGISTERED" }, { t: at, user: "E002", action: "ARCHIVE", to: "ARCHIVED" }],
      approvals: [], assignments: [], numberAt: createdAt + DAY, registeredAt: createdAt + DAY,
      archive: { by: "E002", at, years: 10, location: "Хуучин архив, хайрцаг 3", disposal: "DESTROY" },
      fieldValues: Object.fromEntries(t.fields.filter((f) => f.isRequired).map((f) => [f.name, f.dataType === "text" ? pick(tCode === "CONTRACT" ? PARTIES : ORGS) : iso(createdAt)])),
      versions: 1, summary: `${title} — архивын баримт.`,
    });
  }

  // ── Dugaar olgoh: ognoonii daraallaar, durem+on bureer ──
  plans.sort((a, b) => a.createdAt - b.createdAt);
  const internalNo = new Map<Plan, string>();
  plans.forEach((p, i) => internalNo.set(p, `Д-${String(i + 1).padStart(4, "0")}`));
  const officialNo = new Map<Plan, string>();
  const seqs = new Map<string, number>();
  for (const p of [...plans].filter((x) => x.numberAt).sort((a, b) => a.numberAt! - b.numberAt!)) {
    const tr = typeRow[p.type];
    const year = new Date(p.numberAt!).getFullYear();
    const key = `${tr.ruleId}:${year}`;
    const n = (seqs.get(key) ?? 0) + 1;
    seqs.set(key, n);
    officialNo.set(
      p,
      tr.seed.pattern
        .replace(/\{SEQ:(\d+)\}/, (_m, w: string) => String(n).padStart(Number(w), "0"))
        .replace("{YYYY}", String(year))
        .replace("{YY}", String(year).slice(-2)),
    );
  }

  // ── Ugugdliin sand bichih ──
  const docIds: string[] = [];

  for (const p of plans) {
    const tr = typeRow[p.type];
    const statusCode = p.events.filter((e) => e.to).at(-1)!.to!;
    const doc = await prisma.document.create({
      data: {
        internalNumber: internalNo.get(p)!,
        documentTypeId: tr.id,
        documentNumber: officialNo.get(p) ?? null,
        title: p.title,
        summary: p.summary,
        direction: p.direction,
        confidentiality: weighted([["INTERNAL", 6], ["NORMAL", 3], ["CONFIDENTIAL", 1]]),
        statusId: st[statusCode],
        ownerDepartmentId: dep[emp[p.creator].dept],
        createdById: U(p.creator),
        currentVersionNo: p.versions,
        documentDate: dateOnly(p.createdAt),
        approvedAt: p.approvedAt ? new Date(p.approvedAt) : null,
        registeredAt: p.registeredAt ? new Date(p.registeredAt) : null,
        createdAt: new Date(p.createdAt),
        fieldValues: { create: Object.entries(p.fieldValues).filter(([k]) => tr.fields[k]).map(([k, v]) => ({ fieldId: tr.fields[k], valueText: v })) },
      },
    });
    docIds.push(doc.id);

    // Huwilbar, hawsralt
    let lastVersion = "";
    for (let v = 1; v <= p.versions; v++) {
      const ver = await prisma.documentVersion.create({
        data: { documentId: doc.id, versionNo: v, changeNote: v === 1 ? "Анхны хувилбар" : "Хянагчийн тайлбарын дагуу зассан", createdById: U(p.creator), createdAt: new Date(p.createdAt + (v - 1) * 2 * DAY), snapshot: { title: p.title } },
      });
      lastVersion = ver.id;
    }
    const files = p.type === "INCOMING" ? [`${p.title}.pdf`] : rnd() < 0.5 ? [`${p.title}.pdf`, "Хавсралт.docx"] : [`${p.title}.pdf`];
    for (const [k, fname] of files.entries()) {
      const key = `db:demo-${doc.id}-${k}`;
      const buf = minimalPdf(`Demo document ${doc.internalNumber} - attachment ${k + 1}`);
      await prisma.attachment.create({
        data: {
          documentId: doc.id, versionId: lastVersion, fileName: fname, storageKey: key, mimeType: "application/pdf", fileSize: BigInt(buf.length),
          checksumSha256: createHash("sha256").update(buf).digest("hex"), content: new Uint8Array(buf), isMain: k === 0, uploadedById: U(p.creator), uploadedAt: new Date(p.createdAt),
        },
      });
    }

    for (const a of p.approvals) {
      await prisma.approval.create({ data: { documentId: doc.id, reviewerId: U(a.reviewer), stepOrder: a.step, decision: a.decision, comment: a.comment ?? null, decidedAt: a.at ? new Date(a.at) : null } });
    }
    for (const a of p.assignments) {
      await prisma.assignment.create({
        data: {
          documentId: doc.id, assigneeUserId: a.userCode ? U(a.userCode) : null, assigneeDepartmentId: a.dept ? dep[a.dept] : null, assignedById: U(a.by),
          dueDate: dateOnly(a.due), status: a.status, resultNote: a.note ?? null, assignedAt: new Date(a.at), completedAt: a.done ? new Date(a.done) : null,
        },
      });
    }
    if (p.archive) {
      const until = new Date(p.archive.at);
      until.setUTCFullYear(until.getUTCFullYear() + p.archive.years);
      await prisma.archive.create({
        data: { documentId: doc.id, archivedById: U(p.archive.by), archivedAt: new Date(p.archive.at), archiveCategory: tr.seed.name, retentionUntil: dateOnly(until.getTime()), disposalAction: p.archive.disposal, storageLocation: p.archive.location },
      });
    }

    // Audit (tuluwiin tuuh)
    let prev: string | undefined;
    for (const e of p.events.sort((a, b) => a.t - b.t)) {
      await prisma.auditLog.create({
        data: { userId: U(e.user), documentId: doc.id, entityType: "document", entityId: doc.id, action: e.action, oldStatusId: prev ? st[prev] : null, newStatusId: e.to ? st[e.to] : null, newValue: e.value, createdAt: new Date(e.t), ipAddress: "10.0.0." + (10 + Math.floor(rnd() * 80)) },
      });
      if (e.to) prev = e.to;
    }

    // Medegdel
    const pending = p.approvals.find((a) => a.decision === "PENDING");
    if (pending) await prisma.notification.create({ data: { userId: U(pending.reviewer), documentId: doc.id, type: "REVIEW_REQUESTED", message: `«${p.title}» баримт таны хяналтад ирлээ`, createdAt: new Date(p.events.at(-1)!.t) } });
    const active = p.assignments.find((a) => a.status === "ACTIVE");
    if (active?.userCode) {
      const late = active.due < NOW;
      await prisma.notification.create({ data: { userId: U(active.userCode), documentId: doc.id, type: late ? "REMINDER" : "ASSIGNED", message: late ? `Сануулга: «${p.title}» баримтын хугацаа хэтэрсэн` : `«${p.title}» танд хуваарилагдлаа. Хугацаа: ${iso(active.due)}`, isRead: rnd() < 0.3, createdAt: new Date(active.at) } });
    }
    if (p.target === "RETURNED") await prisma.notification.create({ data: { userId: U(p.creator), documentId: doc.id, type: "RETURNED", message: `«${p.title}» засварт буцлаа`, createdAt: new Date(p.events.at(-1)!.t) } });
  }

  // Holbootoi barimt: hariu bichgiig irsen bichigtei holbono
  const incomingDocs = await prisma.document.findMany({ where: { direction: "INCOMING", documentNumber: { not: null } }, take: 15 });
  const outgoingDocs = await prisma.document.findMany({ where: { direction: "OUTGOING", documentNumber: { not: null } }, take: 15 });
  for (let i = 0; i < Math.min(incomingDocs.length, outgoingDocs.length, 8); i++) {
    await prisma.documentRelation.create({ data: { sourceDocumentId: outgoingDocs[i].id, targetDocumentId: incomingDocs[i].id, relationType: "Хариу", createdById: U("E002") } });
  }

  // Toologchdiig bodit utgatai ni taaruulah (daraagiin dugaar zuw urgeljilne)
  for (const [key, value] of seqs) {
    const [ruleId, year] = key.split(":");
    await prisma.numberSequence.create({ data: { numberingRuleId: ruleId, departmentId: null, periodYear: Number(year), currentValue: value } });
  }
  await prisma.numberSequence.create({ data: { numberingRuleId: null, departmentId: null, periodYear: 0, currentValue: plans.length } });

  // ═════════════ 5. Turshiltiin HR API ugugdul ═════════════
  // Sink hiihed: 2 shine ajiltan nemegdej, 1 ajiltan ajlaas garsan bolno (BD-11-iig haruulna)
  const hr = {
    departments: DEPARTMENTS.map(([code, name]) => ({ code, name, parentCode: code === "MGMT" ? null : "MGMT" })),
    employees: [
      ...PEOPLE.map(([code, lastName, firstName, position, d, username]) => ({
        code, lastName, firstName, position, departmentCode: d, email: username ? `${username}@org.mn` : null, status: code === "E013" ? "LEFT" : "ACTIVE",
      })),
      { code: "E023", lastName: "Өлзий", firstName: "Сэлэнгэ", position: "Хүний нөөцийн ажилтан", departmentCode: "HR", email: "selenge@org.mn", status: "ACTIVE" },
      { code: "E024", lastName: "Чулуун", firstName: "Батжаргал", position: "Мэргэжилтэн", departmentCode: "FIN", email: "batjargal@org.mn", status: "ACTIVE" },
    ],
  };
  await writeFile(path.join(process.cwd(), "prisma", "hr-data.json"), JSON.stringify(hr, null, 2));

  // ═════════════ 6. Meta ugugdluur awtomataar chigluuleh jishee durmuud ═════════════
  await seedRoutingRules(prisma);

  const counts = await prisma.document.groupBy({ by: ["statusId"], _count: true });
  console.log(`Seed амжилттай: ${plans.length} баримт, ${PEOPLE.length} ажилтан, ${TYPES.length} төрөл`);
  for (const [code, name] of STATUSES) console.log(`  ${name}: ${counts.find((c) => c.statusId === st[code])?._count ?? 0}`);
  console.log("Нэвтрэх: admin / records / manager / unit / employee — нууц үг Passw0rd!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
