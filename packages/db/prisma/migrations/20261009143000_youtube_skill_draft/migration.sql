-- AlterTable
ALTER TABLE "DeskSource" ADD COLUMN "inputText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeskSource" ADD COLUMN "skillDraft" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeskSource" ADD COLUMN "skillName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeskSource" ADD COLUMN "skillReadiness" TEXT NOT NULL DEFAULT 'unfinished';
