-- AlterTable
ALTER TABLE "DeskStageArtifact" ADD COLUMN "packageJson" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "DeskCalendarItem" ADD COLUMN "packageJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "DeskCalendarItem" ADD COLUMN "simulated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DeskArtifactRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "packageJson" TEXT NOT NULL DEFAULT '{}',
    "reviewState" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeskArtifactRevision_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "DeskStageArtifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT,
    "summary" TEXT NOT NULL,
    "skillSlug" TEXT,
    "knowledgePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentInsight_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "DeskPublication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "subjectEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "DeskArtifactRevision_artifactId_idx" ON "DeskArtifactRevision"("artifactId");
CREATE INDEX "DeskArtifactRevision_createdAt_idx" ON "DeskArtifactRevision"("createdAt");
CREATE INDEX "ContentInsight_publicationId_idx" ON "ContentInsight"("publicationId");
CREATE INDEX "ContentInsight_status_idx" ON "ContentInsight"("status");
CREATE INDEX "ContentInsight_skillSlug_idx" ON "ContentInsight"("skillSlug");
CREATE INDEX "PrivacyRequest_subjectEmail_idx" ON "PrivacyRequest"("subjectEmail");
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX "PrivacyRequest_kind_idx" ON "PrivacyRequest"("kind");
