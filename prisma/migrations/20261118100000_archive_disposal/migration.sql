-- Хадгалах хугацаа дууссан архивын баримтад гаргасан шийдвэрийг бүртгэх (устгасан / улсын архивт шилжүүлсэн)
ALTER TABLE "archives" ADD COLUMN "disposed_at" TIMESTAMP(3),
ADD COLUMN "disposed_by" UUID,
ADD COLUMN "disposal_note" TEXT;

ALTER TABLE "archives" ADD CONSTRAINT "archives_disposed_by_fkey" FOREIGN KEY ("disposed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
