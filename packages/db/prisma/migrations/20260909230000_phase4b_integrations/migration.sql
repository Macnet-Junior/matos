-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "externalId" TEXT,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "connectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_provider_key" ON "IntegrationAccount"("provider");

-- CreateIndex
CREATE INDEX "IntegrationAccount_status_idx" ON "IntegrationAccount"("status");

-- CreateIndex
CREATE INDEX "IntegrationCredential_accountId_idx" ON "IntegrationCredential"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_accountId_kind_key" ON "IntegrationCredential"("accountId", "kind");
