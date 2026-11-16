-- Prisma схемд илэрхийлэгддэггүй өгөгдлийн сангийн нэмэлт (Хүснэгт 3.29)
-- Ажиллуулах: npm run db:extras   (дахин ажиллуулахад аюулгүй)

-- Түлхүүр үгийн хайлтыг хурдасгах (ФШ-14, ФБШ-06)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS documents_title_trgm_idx   ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS documents_summary_trgm_idx ON documents USING GIN (summary gin_trgm_ops);

-- department_id NULL үед ч тоологч давхардахгүй (PostgreSQL 15+)
CREATE UNIQUE INDEX IF NOT EXISTS number_sequences_rule_dept_year_nnd
  ON number_sequences (numbering_rule_id, department_id, period_year) NULLS NOT DISTINCT;

-- Албан ёсны дугаар нэг төрөлд давхардахгүй (БД-07)
CREATE UNIQUE INDEX IF NOT EXISTS documents_type_number_uq
  ON documents (document_type_id, document_number) WHERE document_number IS NOT NULL;

-- Хариуцагч яг нэг: ажилтан эсвэл нэгж (БД-09)
DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT assignments_one_assignee_chk
    CHECK ((assignee_user_id IS NOT NULL) <> (assignee_department_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Өөртэйгөө хамаарал үүсэхгүй
DO $$ BEGIN
  ALTER TABLE document_relations ADD CONSTRAINT document_relations_not_self_chk
    CHECK (source_document_id <> target_document_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Аудитын бүртгэл зөвхөн нэмэгдэнэ: UPDATE, DELETE-ийг хориглоно (ФБШ-04)
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC;
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  -- Зөвхөн туршилтын өгөгдөл дахин үүсгэх (seed) үед, тухайн гүйлгээнд зөвшөөрнө
  IF TG_OP = 'DELETE' AND current_setting('app.allow_audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs хүснэгтийн бичлэгийг засах, устгах боломжгүй';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_logs_append_only_trg ON audit_logs;
CREATE TRIGGER audit_logs_append_only_trg
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
