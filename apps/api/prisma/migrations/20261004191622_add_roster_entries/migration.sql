-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT,
    "jerseyNumber" INTEGER,
    "userId" TEXT,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterEntry_teamId_idx" ON "RosterEntry"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_lobbyId_userId_key" ON "RosterEntry"("lobbyId", "userId");

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
