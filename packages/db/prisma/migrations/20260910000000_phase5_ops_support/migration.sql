-- CreateTable
CREATE TABLE "UserPresence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Viewer',
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "units" REAL NOT NULL DEFAULT 1,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "units" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "actorEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AutoResponseRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "triggerKeyword" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'support',
    "template" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewGate" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AutoResponseAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "actorEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutoResponseAttempt_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutoResponseRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "requesterEmail" TEXT NOT NULL,
    "assigneeEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'comment',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Support chat',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_email_key" ON "UserPresence"("email");
CREATE INDEX "UserPresence_lastSeenAt_idx" ON "UserPresence"("lastSeenAt");
CREATE INDEX "UsageEvent_userId_idx" ON "UsageEvent"("userId");
CREATE INDEX "UsageEvent_kind_idx" ON "UsageEvent"("kind");
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");
CREATE INDEX "CreditLedger_userId_idx" ON "CreditLedger"("userId");
CREATE INDEX "CreditLedger_createdAt_idx" ON "CreditLedger"("createdAt");
CREATE INDEX "AutoResponseRule_enabled_idx" ON "AutoResponseRule"("enabled");
CREATE INDEX "AutoResponseRule_channel_idx" ON "AutoResponseRule"("channel");
CREATE INDEX "AutoResponseAttempt_ruleId_idx" ON "AutoResponseAttempt"("ruleId");
CREATE INDEX "AutoResponseAttempt_createdAt_idx" ON "AutoResponseAttempt"("createdAt");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_requesterEmail_idx" ON "SupportTicket"("requesterEmail");
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");
CREATE INDEX "ChatThread_userEmail_idx" ON "ChatThread"("userEmail");
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");
