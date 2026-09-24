-- CreateTable
CREATE TABLE "DeskPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "error" TEXT,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskPublication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeskJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentMetric_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "DeskPublication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeskPublication_idempotencyKey_key" ON "DeskPublication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DeskPublication_status_idx" ON "DeskPublication"("status");

-- CreateIndex
CREATE INDEX "DeskPublication_channel_idx" ON "DeskPublication"("channel");

-- CreateIndex
CREATE INDEX "DeskPublication_scheduledAt_idx" ON "DeskPublication"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeskPublication_jobId_channel_key" ON "DeskPublication"("jobId", "channel");

-- CreateIndex
CREATE INDEX "ContentMetric_publicationId_idx" ON "ContentMetric"("publicationId");

-- CreateIndex
CREATE INDEX "ContentMetric_kind_idx" ON "ContentMetric"("kind");

-- CreateIndex
CREATE INDEX "ContentMetric_capturedAt_idx" ON "ContentMetric"("capturedAt");
