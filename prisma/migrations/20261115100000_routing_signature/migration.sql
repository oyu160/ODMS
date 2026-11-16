-- Мета өгөгдлөөр автоматаар чиглүүлэх дүрэм ба цахим гарын үсэг

-- AlterTable
ALTER TABLE "signatures" ADD COLUMN "key_id" UUID,
ADD COLUMN "content_hash" CHAR(64),
ADD COLUMN "signature_value" TEXT;

-- CreateTable
CREATE TABLE "routing_rules" (
    "rule_id" UUID NOT NULL,
    "rule_name" VARCHAR(150) NOT NULL,
    "document_type_id" UUID,
    "confidentiality" VARCHAR(20),
    "direction" VARCHAR(20),
    "department_id" UUID,
    "field_id" UUID,
    "field_value" VARCHAR(255),
    "reviewer_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routing_rules_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "signing_keys" (
    "key_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "public_key" TEXT NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "fingerprint" CHAR(16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "signing_keys_pkey" PRIMARY KEY ("key_id")
);

-- CreateIndex
CREATE INDEX "routing_rules_is_active_priority_idx" ON "routing_rules"("is_active", "priority");
CREATE INDEX "signing_keys_user_id_idx" ON "signing_keys"("user_id");
CREATE INDEX "signatures_document_id_idx" ON "signatures"("document_id");

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "signing_keys"("key_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("document_type_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field_definitions"("field_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Гарын үсэг зурсан мөрийг өөрчлөх, устгахыг хориглоно (аудитын адил зөвхөн нэмэгдэнэ)
CREATE OR REPLACE FUNCTION signatures_immutable() RETURNS trigger AS $$
BEGIN
  -- Зөвхөн туршилтын өгөгдөл дахин үүсгэх (seed) үед, тухайн гүйлгээнд устгахыг зөвшөөрнө
  IF TG_OP = 'DELETE' AND current_setting('app.allow_audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'signatures: гарын үсгийн бичлэгийг өөрчлөх боломжгүй';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER signatures_no_update BEFORE UPDATE OR DELETE ON "signatures"
  FOR EACH ROW EXECUTE FUNCTION signatures_immutable();
