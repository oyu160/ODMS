// Barimtiin tuluwiin shiljilt ba biznesiin durem
// Shiljilt buriig status_transitions husnegtees unshina — shine shiljiltiig kod uurchluhguigeer nemj bolno.
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { CurrentUser } from "./auth";
import { can } from "./permissions";
import { issueOfficialNumber } from "./numbering";
import { writeAudit } from "./audit";
import { resolveRoute } from "./routing";
import { signDocument, SignatureError } from "./signature";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export class WorkflowError extends Error {}

/** Yawsan bichgiin ilgeeh helber */
export const SEND_METHODS: Record<string, string> = {
  HAND: "Биечлэн гардуулсан",
  POST: "Шуудангаар",
  EMAIL: "Имэйлээр",
  EDOC: "Цахим баримт солилцооны системээр",
};

export const ACTION_LABELS: Record<string, string> = {
  submit: "Хяналтад илгээх",
  resubmit: "Засаад дахин илгээх",
  approve: "Батлах",
  return: "Засварт буцаах",
  register: "Бүртгэх",
  register_incoming: "Ирсэн бичгийг бүртгэх",
  send: "Илгээсэн гэж бүртгэх",
  assign: "Хуваарилах",
  reassign: "Дахин хуваарилах",
  resolve: "Шийдвэрлэх",
  archive: "Архивлах",
  cancel: "Цуцлах",
  revoke: "Батламжийг цуцлах",
  forward: "Дараагийн хянагч руу шилжүүлэх",
};

/** Auditiin bichlegiin ner (Uildliin tuuhed haruulna) */
export const AUDIT_LABELS: Record<string, string> = {
  CREATE: "Үүсгэсэн",
  UPDATE: "Зассан",
  REVIEWER_EDIT: "Хянагч засвар оруулсан",
  SUBMIT: "Хяналтад илгээсэн",
  RESUBMIT: "Дахин илгээсэн",
  APPROVE: "Баталсан",
  RETURN: "Засварт буцаасан",
  REGISTER: "Бүртгэсэн",
  REGISTER_INCOMING: "Ирсэн бичгийг бүртгэсэн",
  SEND: "Хүлээн авагч руу илгээсэн",
  ASSIGN: "Хуваарилсан",
  REASSIGN: "Дахин хуваарилсан",
  RESOLVE: "Шийдвэрлэсэн",
  ARCHIVE: "Архивласан",
  CANCEL: "Цуцалсан",
  REVOKE: "Батламжийг цуцалсан",
  FORWARD: "Дараагийн хянагч руу шилжүүлсэн",
  REMIND: "Сануулга илгээсэн",
  DOWNLOAD: "Файл татсан",
  ATTACH: "Файл хавсаргасан",
  LOGIN: "Нэвтэрсэн",
  EXPORT: "Тайлан татсан",
  PRINT: "Тайлан хэвлэсэн",
  SETTINGS: "Тохиргоо өөрчилсөн",
  HR_SYNC: "HR синхрончлол",
  USER_CREATE: "Хэрэглэгч үүсгэсэн",
  USER_DISABLE: "Хэрэглэгч хаасан",
  USER_ENABLE: "Хэрэглэгч идэвхжүүлсэн",
  ROLE_CHANGE: "Үүрэг өөрчилсөн",
  PASSWORD_RESET: "Нууц үг сэргээсэн",
  RELATE: "Хамаарал үүсгэсэн",
  UNRELATE: "Хамаарал хассан",
  DISPOSE: "Хадгалах хугацааны шийдвэр гаргасан",
};

type DocLite = { id: string; statusId: string; documentTypeId: string; createdById: string; direction: string };

async function isAssignee(db: Db, user: CurrentUser, documentId: string) {
  const a = await db.assignment.findFirst({
    where: { documentId, status: "ACTIVE", OR: [{ assigneeUserId: user.id }, { assigneeDepartmentId: user.departmentId }] },
  });
  return !!a;
}

/** Biznesiin durem — zurchiltei bol shaltgaaniig butsaana */
export async function ruleViolation(db: Db, user: CurrentUser, doc: DocLite, action: string): Promise<string | null> {
  switch (action) {
    case "submit":
    case "resubmit":
      if (doc.createdById !== user.id) return "Зөвхөн баримтыг үүсгэгч хяналтад илгээнэ";
      if (doc.direction === "INCOMING") return "Ирсэн бичиг хяналтын урсгалаар явахгүй";
      return null;
    case "cancel":
      if (doc.createdById !== user.id && !can(user, "document.view_all")) return "Зөвхөн үүсгэгч цуцална";
      return null;
    case "approve":
    case "return":
    case "forward": {
      if (doc.createdById === user.id) return "Өөрийн үүсгэсэн баримтыг батлах боломжгүй (БД-05)";
      const pending = await db.approval.findFirst({ where: { documentId: doc.id, reviewerId: user.id, decision: "PENDING" } });
      return pending ? null : "Энэ баримт танд хяналтаар ирээгүй байна";
    }
    // Batlamj tsutslah: zuwhun batalsan hun, burtgegdehees umnu (APPROVED tuluwt)
    case "revoke": {
      const approved = await db.approval.findFirst({ where: { documentId: doc.id, decision: "APPROVED" }, orderBy: { decidedAt: "desc" } });
      return approved?.reviewerId === user.id ? null : "Зөвхөн баримтыг баталсан хүн батламжийг цуцална";
    }
    case "register_incoming":
      return doc.direction === "INCOMING" ? null : "Зөвхөн ирсэн бичигт хамаарна";
    // Yawsan bichig dotood hariutsagchid huwaarilagdahgui: burtgesnii daraa huleen awagch ruu ilgeegdene
    case "send":
      return doc.direction === "OUTGOING" ? null : "Зөвхөн явсан бичгийг илгээнэ";
    case "assign":
      return doc.direction === "OUTGOING" ? "Явсан бичгийг хуваарилахгүй, хүлээн авагч руу илгээнэ" : null;
    case "archive": {
      if (doc.direction !== "OUTGOING") return null;
      const st = await db.documentStatus.findUnique({ where: { id: doc.statusId }, select: { code: true } });
      return st?.code === "REGISTERED" ? "Явсан бичгийг эхлээд илгээж бүртгэнэ" : null;
    }
    case "resolve":
      return (await isAssignee(db, user, doc.id)) ? null : "Зөвхөн хариуцагч шийдвэрлэнэ";
    default:
      return null;
  }
}

async function findTransition(db: Db, doc: DocLite, action: string) {
  const list = await db.statusTransition.findMany({
    where: { fromStatusId: doc.statusId, actionCode: action, OR: [{ documentTypeId: null }, { documentTypeId: doc.documentTypeId }] },
    include: { permission: true, toStatus: true },
  });
  return list.find((t) => t.documentTypeId === doc.documentTypeId) ?? list[0] ?? null;
}

/** Hereglegchid odoo haragdah uildliin towchnuud */
export async function availableActions(user: CurrentUser, doc: DocLite) {
  const transitions = await prisma.statusTransition.findMany({
    where: { fromStatusId: doc.statusId, OR: [{ documentTypeId: null }, { documentTypeId: doc.documentTypeId }] },
    include: { permission: true },
  });
  const result: { code: string; label: string }[] = [];
  for (const t of transitions) {
    if (result.some((r) => r.code === t.actionCode)) continue;
    // Shoshgogui (heregjuuleltgui) uildliig towch bolgoj haruulahgui, jish: hasagdsan "revoke"
    if (!ACTION_LABELS[t.actionCode]) continue;
    // Erhgui bol towch haragdahgui. resolve-d nemeed hariutsagch eseh ruleViolation-d shalgagdana
    // (Admin document.resolve erhgui tul negjid ni huwaarilsan barimtiig shiidwerlehgui)
    if (!can(user, t.permission.code)) continue;
    if (await ruleViolation(prisma, user, doc, t.actionCode)) continue;
    result.push({ code: t.actionCode, label: ACTION_LABELS[t.actionCode] });
  }
  return result;
}

export type ActionInput = {
  comment?: string;
  reviewerId?: string;
  assigneeUserId?: string;
  assigneeDepartmentId?: string;
  dueDate?: string;
  archiveCategory?: string;
  storageLocation?: string;
  disposalAction?: string;
  /** Batlah ued tsahim gariin useg zurahad nuuts ugiig dahin oruulna */
  password?: string;
  /** Yawsan bichgiin ilgeelt */
  sentAt?: string;
  sendMethod?: string;
  recipient?: string;
  receiptRef?: string;
};

async function notifyDepartment(tx: Tx, departmentId: string, documentId: string, type: string, message: string) {
  const users = await tx.user.findMany({ where: { isActive: true, employee: { departmentId, employmentStatus: "ACTIVE" } }, select: { id: true } });
  if (users.length) await tx.notification.createMany({ data: users.map((u) => ({ userId: u.id, documentId, type, message })) });
}

/** Huwaarilaltiin oroltiig shalgana (BD-09: neg hereglegch ESWEL neg negj) */
async function readAssignee(tx: Tx, input: ActionInput) {
  const hasUser = !!input.assigneeUserId;
  const hasDept = !!input.assigneeDepartmentId;
  if (hasUser === hasDept) throw new WorkflowError("Хариуцагчаар нэг ажилтан эсвэл нэг нэгжийг сонгоно (БД-09)");
  if (!input.dueDate) throw new WorkflowError("Шийдвэрлэх хугацааг оруулна уу");
  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) throw new WorkflowError("Хугацаа буруу байна");

  if (hasUser) {
    const u = await tx.user.findUnique({ where: { id: input.assigneeUserId }, include: { employee: true } });
    if (!u || !u.isActive || u.employee.employmentStatus !== "ACTIVE") throw new WorkflowError("Сонгосон ажилтан идэвхгүй байна (БД-11)");
    return { assigneeUserId: u.id, assigneeDepartmentId: null, dueDate: due, label: `${u.employee.lastName.charAt(0)}.${u.employee.firstName}` };
  }
  const d = await tx.department.findUnique({ where: { id: input.assigneeDepartmentId } });
  if (!d || !d.isActive) throw new WorkflowError("Сонгосон нэгж идэвхгүй байна");
  return { assigneeUserId: null, assigneeDepartmentId: d.id, dueDate: due, label: d.name };
}

/** Hyanagchiig shalgana: idewhtei, batlah erhtei, uusgegch bish (BD-03, BD-05) */
async function readReviewer(tx: Tx, reviewerId: string | undefined, creatorId: string) {
  const reviewer = reviewerId
    ? await tx.user.findUnique({
        where: { id: reviewerId },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
      })
    : null;
  if (!reviewer || !reviewer.isActive) throw new WorkflowError("Хянагчийг сонгоно уу");
  if (reviewer.id === creatorId) throw new WorkflowError("Баримт үүсгэгчийг хянагчаар сонгох боломжгүй (БД-05)");
  const canApprove = reviewer.roles.some((ur) => ur.role.permissions.some((rp) => rp.permission.code === "document.approve"));
  if (!canApprove) throw new WorkflowError("Сонгосон хэрэглэгч батлах эрхгүй байна");
  return reviewer;
}

/** Uildliig neg transaction-aar guitsetgene: shalgah → uurchluh → audit → medegdel */
export async function performAction(user: CurrentUser, documentId: string, action: string, input: ActionInput) {
  return prisma.$transaction(async (tx) => {
    // Barimtiin muriig tugjine: hoyor hereglegch zereg uildel hiihees sergiilne
    await tx.$executeRaw`SELECT 1 FROM documents WHERE document_id = ${documentId}::uuid FOR UPDATE`;
    const doc = await tx.document.findUnique({ where: { id: documentId }, include: { documentType: true } });
    if (!doc || doc.isDeleted) throw new WorkflowError("Баримт олдсонгүй");

    const tr = await findTransition(tx, doc, action);
    if (!tr) throw new WorkflowError("Одоогийн төлөвөөс энэ үйлдлийг хийх боломжгүй");
    if (!can(user, tr.permission.code)) throw new WorkflowError("Танд энэ үйлдлийг хийх эрх байхгүй");
    const violation = await ruleViolation(tx, user, doc, action);
    if (violation) throw new WorkflowError(violation);

    const data: Prisma.DocumentUncheckedUpdateInput = { statusId: tr.toStatusId };
    const now = new Date();
    const comment = input.comment?.trim() || undefined;
    let auditValue: Prisma.InputJsonValue | undefined = comment ? { comment } : undefined;

    switch (action) {
      case "submit":
      case "resubmit": {
        // Hyanagchiig garaar songoogui bol meta ugugdliin durmeer awtomataar chigluulne
        let routedBy: string | null = null;
        let reviewerId = input.reviewerId;
        if (!reviewerId) {
          const fields = await tx.documentFieldValue.findMany({ where: { documentId }, select: { fieldId: true, valueText: true } });
          const rule = await resolveRoute(tx, { ...doc, fields });
          if (!rule) throw new WorkflowError("Тохирох чиглүүлэх дүрэм олдсонгүй. Хянагчийг гараар сонгоно уу");
          reviewerId = rule.reviewerId;
          routedBy = rule.name;
        }
        const reviewer = await readReviewer(tx, reviewerId, doc.createdById);
        auditValue = { routing: routedBy ? `Автоматаар чиглүүлсэн: ${routedBy}` : "Хянагчийг гараар сонгосон", ...(comment ? { comment } : {}) };

        const steps = await tx.approval.count({ where: { documentId } });
        await tx.approval.create({ data: { documentId, reviewerId: reviewer.id, stepOrder: steps + 1, comment: null } });
        await tx.notification.create({
          data: { userId: reviewer.id, documentId, type: "REVIEW_REQUESTED", message: `«${doc.title}» баримт таны хяналтад ирлээ` },
        });
        break;
      }
      case "approve": {
        await tx.approval.updateMany({
          where: { documentId, reviewerId: user.id, decision: "PENDING" },
          data: { decision: "APPROVED", decidedAt: now, comment: comment ?? null },
        });
        // BD-07: alban yosnii dugaariig zuwhun batlagdah ued olgono
        const num = await issueOfficialNumber(tx, documentId);
        data.documentNumber = num;
        data.approvedAt = now;
        // Tsahim gariin useg: nuuts ugeer tulhuuree neej, batlagdsan aguulgiin SHA-256 heshiig zurna
        let signature;
        try {
          signature = await signDocument(tx, { documentId, userId: user.id, password: input.password, documentNumber: num });
        } catch (e) {
          if (e instanceof SignatureError) throw new WorkflowError(e.message);
          throw e;
        }
        auditValue = { number: num, signature: `Цахим гарын үсэг ${signature.certificateSerial ?? ""}`, ...(comment ? { comment } : {}) };
        await tx.notification.create({
          data: { userId: doc.createdById, documentId, type: "APPROVED", message: `«${doc.title}» батлагдлаа. Дугаар: ${num}` },
        });
        break;
      }
      case "return": {
        if (!comment) throw new WorkflowError("Буцаах шалтгааныг бичнэ үү");
        await tx.approval.updateMany({
          where: { documentId, reviewerId: user.id, decision: "PENDING" },
          data: { decision: "RETURNED", decidedAt: now, comment },
        });
        await tx.notification.create({
          data: { userId: doc.createdById, documentId, type: "RETURNED", message: `«${doc.title}» засварт буцлаа: ${comment}` },
        });
        break;
      }
      case "forward": {
        // BD-04: olon shatlalt hyanalt — odoogiin shatiig haaj, daraagiin hyanagchid shine shat uusgene
        const next = await readReviewer(tx, input.reviewerId, doc.createdById);
        if (next.id === user.id) throw new WorkflowError("Өөр хянагч сонгоно уу");
        await tx.approval.updateMany({
          where: { documentId, reviewerId: user.id, decision: "PENDING" },
          data: { decision: "FORWARDED", decidedAt: now, comment: comment ?? null },
        });
        const steps = await tx.approval.count({ where: { documentId } });
        await tx.approval.create({ data: { documentId, reviewerId: next.id, stepOrder: steps + 1 } });
        await tx.notification.create({
          data: { userId: next.id, documentId, type: "REVIEW_REQUESTED", message: `«${doc.title}» баримт таны хяналтад ирлээ (дараагийн шат)` },
        });
        await tx.notification.create({
          data: { userId: doc.createdById, documentId, type: "FORWARDED", message: `«${doc.title}» дараагийн хянагч руу шилжлээ` },
        });
        auditValue = { nextReviewerId: next.id, step: steps + 1, ...(comment ? { comment } : {}) };
        break;
      }
      case "register":
        data.registeredAt = now;
        break;
      case "register_incoming": {
        const num = await issueOfficialNumber(tx, documentId);
        data.documentNumber = num;
        data.registeredAt = now;
        auditValue = { number: num };
        break;
      }
      case "send": {
        const recipient = input.recipient?.trim();
        if (!recipient) throw new WorkflowError("Хүлээн авагчийг оруулна уу");
        if (!input.sendMethod || !SEND_METHODS[input.sendMethod]) throw new WorkflowError("Илгээсэн хэлбэрийг сонгоно уу");
        const sentAt = new Date(input.sentAt ?? "");
        if (!input.sentAt || Number.isNaN(sentAt.getTime())) throw new WorkflowError("Илгээсэн огноог оруулна уу");
        if (sentAt.getTime() > now.getTime()) throw new WorkflowError("Илгээсэн огноо ирээдүйд байж болохгүй");
        if (doc.registeredAt && sentAt.getTime() < Date.UTC(doc.registeredAt.getUTCFullYear(), doc.registeredAt.getUTCMonth(), doc.registeredAt.getUTCDate()))
          throw new WorkflowError("Илгээсэн огноо бүртгэсэн огнооноос өмнө байж болохгүй");
        const receiptRef = input.receiptRef?.trim() || null;
        await tx.dispatch.create({ data: { documentId, sentById: user.id, sentAt, method: input.sendMethod, recipient, receiptRef, note: comment ?? null } });
        await tx.notification.create({
          data: { userId: doc.createdById, documentId, type: "SENT", message: `«${doc.title}» ${recipient}-д илгээгдлээ (${SEND_METHODS[input.sendMethod].toLowerCase()})` },
        });
        auditValue = { recipient, method: SEND_METHODS[input.sendMethod], sentAt: input.sentAt, ...(receiptRef ? { receiptRef } : {}), ...(comment ? { comment } : {}) };
        break;
      }
      case "assign":
      case "reassign": {
        const a = await readAssignee(tx, input);
        if (action === "reassign") {
          // BD-11: hariutsagch shiljsen, garsan ued umnuh huwaarilaltiig haagaad shineer onoono
          await tx.assignment.updateMany({ where: { documentId, status: "ACTIVE" }, data: { status: "REASSIGNED", completedAt: now, resultNote: comment ?? "Дахин хуваарилсан" } });
        }
        await tx.assignment.create({
          data: { documentId, assigneeUserId: a.assigneeUserId, assigneeDepartmentId: a.assigneeDepartmentId, assignedById: user.id, dueDate: a.dueDate },
        });
        const msg = `«${doc.title}» танд хуваарилагдлаа. Хугацаа: ${input.dueDate}`;
        if (a.assigneeUserId) await tx.notification.create({ data: { userId: a.assigneeUserId, documentId, type: "ASSIGNED", message: msg } });
        else if (a.assigneeDepartmentId) await notifyDepartment(tx, a.assigneeDepartmentId, documentId, "ASSIGNED", msg);
        auditValue = { assignee: a.label, dueDate: input.dueDate!, ...(comment ? { comment } : {}) };
        break;
      }
      case "resolve": {
        if (!comment) throw new WorkflowError("Шийдвэрлэлтийн үр дүнг бичнэ үү");
        const active = await tx.assignment.findMany({ where: { documentId, status: "ACTIVE" } });
        await tx.assignment.updateMany({ where: { documentId, status: "ACTIVE" }, data: { status: "DONE", completedAt: now, resultNote: comment } });
        for (const a of active) {
          await tx.notification.create({ data: { userId: a.assignedById, documentId, type: "RESOLVED", message: `«${doc.title}» шийдвэрлэгдлээ` } });
        }
        break;
      }
      case "archive": {
        const years = doc.documentType.defaultRetentionYears;
        const until = years ? new Date(Date.UTC(now.getUTCFullYear() + years, now.getUTCMonth(), now.getUTCDate())) : null;
        await tx.archive.create({
          data: {
            documentId,
            archivedById: user.id,
            archiveCategory: input.archiveCategory?.trim() || doc.documentType.name,
            storageLocation: input.storageLocation?.trim() || null,
            disposalAction: input.disposalAction || "DESTROY",
            retentionUntil: until,
          },
        });
        break;
      }
      case "revoke": {
        // Albn dugaar hadgalagdana (dahin batlahad mun dugaar), gariin useg ustgagdahgui — «tsutslagdsan» gej haragdana
        if (!comment) throw new WorkflowError("Батламжийг цуцлах шалтгааныг бичнэ үү");
        data.approvedAt = null;
        await tx.notification.create({
          data: { userId: doc.createdById, documentId, type: "RETURNED", message: `«${doc.title}» батламж цуцлагдаж засварт буцлаа: ${comment}` },
        });
        break;
      }
      case "cancel":
        if (!comment) throw new WorkflowError("Цуцлах шалтгааныг бичнэ үү (БД-04)");
        await tx.approval.updateMany({ where: { documentId, decision: "PENDING" }, data: { decision: "CANCELLED", decidedAt: now } });
        break;
    }

    const updated = await tx.document.update({ where: { id: documentId }, data });
    await writeAudit(
      {
        userId: user.id,
        documentId,
        entityType: "document",
        entityId: documentId,
        action: action.toUpperCase(),
        oldStatusId: doc.statusId,
        newStatusId: tr.toStatusId,
        newValue: auditValue,
      },
      tx,
    );
    return updated;
  });
}

/** Hugatsaa hetersen huwaarilaltiin hariutsagchid sanuulga ilgeeh */
export async function remindAssignment(user: CurrentUser, assignmentId: string) {
  if (!can(user, "document.assign")) throw new WorkflowError("Танд эрх байхгүй");
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { document: true } });
  if (!a || a.status !== "ACTIVE") throw new WorkflowError("Идэвхтэй хуваарилалт олдсонгүй");
  const msg = `Сануулга: «${a.document.title}» баримтын шийдвэрлэх хугацаа ${a.dueDate ? a.dueDate.toISOString().slice(0, 10) : ""}`;
  await prisma.$transaction(async (tx) => {
    if (a.assigneeUserId) await tx.notification.create({ data: { userId: a.assigneeUserId, documentId: a.documentId, type: "REMINDER", message: msg } });
    else if (a.assigneeDepartmentId) await notifyDepartment(tx, a.assigneeDepartmentId, a.documentId, "REMINDER", msg);
    await writeAudit({ userId: user.id, documentId: a.documentId, entityType: "assignment", entityId: a.id, action: "REMIND" }, tx);
  });
}
