-- ФБШ-01: нэвтрэлтийн түгжээ
ALTER TABLE "users" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMP(3);

-- БД-09: хуваарилалтын хугацаа заавал (хоосон мөрөнд 7 хоног онооно)
UPDATE "assignments" SET "due_date" = ("assigned_at" + INTERVAL '7 days')::date WHERE "due_date" IS NULL;
ALTER TABLE "assignments" ALTER COLUMN "due_date" SET NOT NULL;
