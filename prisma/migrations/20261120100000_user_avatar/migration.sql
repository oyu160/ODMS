-- Хэрэглэгчийн туршилтын санал: профайлын зураг
ALTER TABLE "users" ADD COLUMN "avatar" BYTEA,
  ADD COLUMN "avatar_mime" VARCHAR(50),
  ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
