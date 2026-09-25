-- CreateTable
CREATE TABLE "DeskSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT '',
    "language" TEXT,
    "durationMs" INTEGER,
    "transcript" TEXT NOT NULL DEFAULT '',
    "segmentsJson" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DeskJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeskSource_createdBy_idx" ON "DeskSource"("createdBy");

-- CreateIndex
CREATE INDEX "DeskSource_jobId_idx" ON "DeskSource"("jobId");

-- CreateIndex
CREATE INDEX "DeskSource_status_idx" ON "DeskSource"("status");

-- CreateIndex
CREATE INDEX "DeskSource_createdAt_idx" ON "DeskSource"("createdAt");
