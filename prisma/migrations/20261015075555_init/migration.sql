-- CreateTable
CREATE TABLE "departments" (
    "department_id" UUID NOT NULL,
    "parent_department_id" UUID,
    "department_code" VARCHAR(50) NOT NULL,
    "department_name" VARCHAR(150) NOT NULL,
    "hr_ref_id" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "employee_id" UUID NOT NULL,
    "employee_code" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "position_name" VARCHAR(150),
    "department_id" UUID NOT NULL,
    "email" VARCHAR(150),
    "employment_status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" UUID NOT NULL,
    "role_code" VARCHAR(50) NOT NULL,
    "role_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "permission_id" UUID NOT NULL,
    "permission_code" VARCHAR(100) NOT NULL,
    "permission_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "category_id" UUID NOT NULL,
    "category_code" VARCHAR(50) NOT NULL,
    "category_name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "document_type_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "numbering_rule_id" UUID,
    "type_code" VARCHAR(50) NOT NULL,
    "type_name" VARCHAR(150) NOT NULL,
    "default_retention_years" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("document_type_id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "field_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "field_label" VARCHAR(150) NOT NULL,
    "data_type" VARCHAR(30) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("field_id")
);

-- CreateTable
CREATE TABLE "numbering_rules" (
    "numbering_rule_id" UUID NOT NULL,
    "pattern" VARCHAR(100) NOT NULL,
    "reset_period" VARCHAR(20) NOT NULL DEFAULT 'YEARLY',
    "per_department" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "numbering_rules_pkey" PRIMARY KEY ("numbering_rule_id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "sequence_id" UUID NOT NULL,
    "numbering_rule_id" UUID,
    "department_id" UUID,
    "period_year" INTEGER NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("sequence_id")
);

-- CreateTable
CREATE TABLE "document_statuses" (
    "status_id" UUID NOT NULL,
    "status_code" VARCHAR(50) NOT NULL,
    "status_name" VARCHAR(50) NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_statuses_pkey" PRIMARY KEY ("status_id")
);

-- CreateTable
CREATE TABLE "status_transitions" (
    "transition_id" UUID NOT NULL,
    "document_type_id" UUID,
    "from_status_id" UUID NOT NULL,
    "to_status_id" UUID NOT NULL,
    "action_code" VARCHAR(50) NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("transition_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "document_id" UUID NOT NULL,
    "internal_number" VARCHAR(30) NOT NULL,
    "document_type_id" UUID NOT NULL,
    "document_number" VARCHAR(100),
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "direction" VARCHAR(20) NOT NULL,
    "confidentiality" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "status_id" UUID NOT NULL,
    "owner_department_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "current_version_no" INTEGER NOT NULL DEFAULT 1,
    "document_date" DATE,
    "approved_at" TIMESTAMP(3),
    "registered_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "document_field_values" (
    "value_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value_text" TEXT NOT NULL,

    CONSTRAINT "document_field_values_pkey" PRIMARY KEY ("value_id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "version_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "change_note" TEXT,
    "snapshot" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("version_id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "attachment_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateTable
CREATE TABLE "document_employees" (
    "document_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "relation_role" VARCHAR(50) NOT NULL,

    CONSTRAINT "document_employees_pkey" PRIMARY KEY ("document_id","employee_id","relation_role")
);

-- CreateTable
CREATE TABLE "document_relations" (
    "relation_id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "target_document_id" UUID NOT NULL,
    "relation_type" VARCHAR(50) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_relations_pkey" PRIMARY KEY ("relation_id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "approval_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL DEFAULT 1,
    "reviewer_id" UUID NOT NULL,
    "decision" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "due_date" DATE,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("approval_id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "signature_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "attachment_id" UUID,
    "signed_by" UUID NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "certificate_serial" VARCHAR(100),
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("signature_id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "assignment_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "assignee_user_id" UUID,
    "assignee_department_id" UUID,
    "assigned_by" UUID NOT NULL,
    "due_date" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "result_note" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "archives" (
    "archive_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "archived_by" UUID NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archive_category" VARCHAR(100),
    "retention_until" DATE,
    "disposal_action" VARCHAR(30),
    "storage_location" TEXT,

    CONSTRAINT "archives_pkey" PRIMARY KEY ("archive_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "old_status_id" UUID,
    "new_status_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_department_code_key" ON "departments"("department_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_code_key" ON "roles"("role_code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permission_code_key" ON "permissions"("permission_code");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_category_code_key" ON "document_categories"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_type_code_key" ON "document_types"("type_code");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_document_type_id_field_name_key" ON "field_definitions"("document_type_id", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_numbering_rule_id_department_id_period_yea_key" ON "number_sequences"("numbering_rule_id", "department_id", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "document_statuses_status_code_key" ON "document_statuses"("status_code");

-- CreateIndex
CREATE INDEX "status_transitions_from_status_id_action_code_idx" ON "status_transitions"("from_status_id", "action_code");

-- CreateIndex
CREATE UNIQUE INDEX "documents_internal_number_key" ON "documents"("internal_number");

-- CreateIndex
CREATE INDEX "documents_status_id_idx" ON "documents"("status_id");

-- CreateIndex
CREATE INDEX "documents_document_type_id_idx" ON "documents"("document_type_id");

-- CreateIndex
CREATE INDEX "documents_owner_department_id_idx" ON "documents"("owner_department_id");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_field_values_document_id_field_id_key" ON "document_field_values"("document_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_no_key" ON "document_versions"("document_id", "version_no");

-- CreateIndex
CREATE INDEX "approvals_reviewer_id_decision_idx" ON "approvals"("reviewer_id", "decision");

-- CreateIndex
CREATE INDEX "assignments_assignee_user_id_status_idx" ON "assignments"("assignee_user_id", "status");

-- CreateIndex
CREATE INDEX "assignments_due_date_idx" ON "assignments"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "archives_document_id_key" ON "archives"("document_id");

-- CreateIndex
CREATE INDEX "audit_logs_document_id_idx" ON "audit_logs"("document_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_department_id_fkey" FOREIGN KEY ("parent_department_id") REFERENCES "departments"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_numbering_rule_id_fkey" FOREIGN KEY ("numbering_rule_id") REFERENCES "numbering_rules"("numbering_rule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("document_type_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_numbering_rule_id_fkey" FOREIGN KEY ("numbering_rule_id") REFERENCES "numbering_rules"("numbering_rule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("document_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "document_statuses"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "document_statuses"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("document_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "document_statuses"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_department_id_fkey" FOREIGN KEY ("owner_department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_field_values" ADD CONSTRAINT "document_field_values_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_field_values" ADD CONSTRAINT "document_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field_definitions"("field_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("version_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_employees" ADD CONSTRAINT "document_employees_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_employees" ADD CONSTRAINT "document_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_target_document_id_fkey" FOREIGN KEY ("target_document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("attachment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assignee_department_id_fkey" FOREIGN KEY ("assignee_department_id") REFERENCES "departments"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archives" ADD CONSTRAINT "archives_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archives" ADD CONSTRAINT "archives_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_old_status_id_fkey" FOREIGN KEY ("old_status_id") REFERENCES "document_statuses"("status_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_new_status_id_fkey" FOREIGN KEY ("new_status_id") REFERENCES "document_statuses"("status_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;
