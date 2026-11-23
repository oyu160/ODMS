-- Явсан бичгийн илгээлт: хэзээ, ямар хэлбэрээр, хэнд хүргэсэн
CREATE TABLE "document_dispatches" (
    "dispatch_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "sent_by" UUID NOT NULL,
    "sent_at" DATE NOT NULL,
    "send_method" VARCHAR(20) NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "receipt_ref" VARCHAR(150),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_dispatches_pkey" PRIMARY KEY ("dispatch_id")
);

CREATE UNIQUE INDEX "document_dispatches_document_id_key" ON "document_dispatches"("document_id");

ALTER TABLE "document_dispatches" ADD CONSTRAINT "document_dispatches_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_dispatches" ADD CONSTRAINT "document_dispatches_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Шинэ төлөв «Илгээсэн» (Бүртгэгдсэний дараа). Seed хийгээгүй сан дээр ч ажиллана
UPDATE "document_statuses" SET "display_order" = "display_order" + 1
  WHERE "display_order" >= 6 AND "status_code" <> 'SENT'
    AND NOT EXISTS (SELECT 1 FROM "document_statuses" WHERE "status_code" = 'SENT');
INSERT INTO "document_statuses" ("status_id", "status_code", "status_name", "is_final", "display_order")
  VALUES (gen_random_uuid(), 'SENT', 'Илгээсэн', false, 6)
  ON CONFLICT ("status_code") DO NOTHING;

-- Шилжилт: Бүртгэгдсэн → Илгээсэн (send), Илгээсэн → Архивлагдсан (archive),
-- Батлагдсан → Засварт буцаасан (revoke: баталсан хүн бүртгэгдэхээс өмнө батламжаа цуцална)
INSERT INTO "status_transitions" ("transition_id", "document_type_id", "from_status_id", "to_status_id", "action_code", "permission_id")
SELECT gen_random_uuid(), NULL, f."status_id", t."status_id", v.action, p."permission_id"
FROM (VALUES ('REGISTERED', 'SENT', 'send', 'document.register'),
             ('SENT', 'ARCHIVED', 'archive', 'document.archive'),
             ('APPROVED', 'RETURNED', 'revoke', 'document.approve')) AS v(from_code, to_code, action, perm)
JOIN "document_statuses" f ON f."status_code" = v.from_code
JOIN "document_statuses" t ON t."status_code" = v.to_code
JOIN "permissions" p ON p."permission_code" = v.perm
WHERE NOT EXISTS (
  SELECT 1 FROM "status_transitions" x WHERE x."from_status_id" = f."status_id" AND x."to_status_id" = t."status_id" AND x."action_code" = v.action
);
