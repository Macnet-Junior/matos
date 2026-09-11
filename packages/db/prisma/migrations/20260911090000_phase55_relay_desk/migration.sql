-- CreateTable
CREATE TABLE "DeskJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT '',
    "offerCta" TEXT NOT NULL DEFAULT '',
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "dueAt" DATETIME,
    "stage" TEXT NOT NULL DEFAULT 'scout',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "filedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeskStageArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "reviewState" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskStageArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeskJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeskCalendarItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskCalendarItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeskJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeskInboxItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "copiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskInboxItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeskJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeskJob_stage_idx" ON "DeskJob"("stage");

-- CreateIndex
CREATE INDEX "DeskJob_status_idx" ON "DeskJob"("status");

-- CreateIndex
CREATE INDEX "DeskJob_createdAt_idx" ON "DeskJob"("createdAt");

-- CreateIndex
CREATE INDEX "DeskJob_filedAt_idx" ON "DeskJob"("filedAt");

-- CreateIndex
CREATE INDEX "DeskStageArtifact_jobId_idx" ON "DeskStageArtifact"("jobId");

-- CreateIndex
CREATE INDEX "DeskStageArtifact_stage_idx" ON "DeskStageArtifact"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "DeskStageArtifact_jobId_stage_key" ON "DeskStageArtifact"("jobId", "stage");

-- CreateIndex
CREATE INDEX "DeskCalendarItem_jobId_idx" ON "DeskCalendarItem"("jobId");

-- CreateIndex
CREATE INDEX "DeskCalendarItem_scheduledAt_idx" ON "DeskCalendarItem"("scheduledAt");

-- CreateIndex
CREATE INDEX "DeskInboxItem_jobId_idx" ON "DeskInboxItem"("jobId");

-- CreateIndex
CREATE INDEX "DeskInboxItem_status_idx" ON "DeskInboxItem"("status");

-- CreateIndex
CREATE INDEX "DeskInboxItem_createdAt_idx" ON "DeskInboxItem"("createdAt");
