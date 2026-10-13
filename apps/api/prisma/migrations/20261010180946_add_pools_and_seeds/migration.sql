/*
  Warnings:

  - A unique constraint covering the columns `[lobbyId,seed]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "poolId" TEXT,
ADD COLUMN     "seed" INTEGER;

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pool_lobbyId_name_key" ON "Pool"("lobbyId", "name");

-- CreateIndex
CREATE INDEX "Team_poolId_idx" ON "Team"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_lobbyId_seed_key" ON "Team"("lobbyId", "seed");

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
