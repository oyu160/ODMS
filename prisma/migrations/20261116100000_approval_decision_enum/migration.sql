-- Хяналтын шийдвэрийг VARCHAR-аас ENUM төрөл болгох: буруу утга хадгалагдах боломжгүй болно
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'RETURNED', 'FORWARDED', 'CANCELLED');

ALTER TABLE "approvals" ALTER COLUMN "decision" DROP DEFAULT;
ALTER TABLE "approvals" ALTER COLUMN "decision" TYPE "ApprovalDecision" USING ("decision"::"ApprovalDecision");
ALTER TABLE "approvals" ALTER COLUMN "decision" SET DEFAULT 'PENDING';
