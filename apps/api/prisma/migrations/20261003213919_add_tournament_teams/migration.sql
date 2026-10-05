-- CreateEnum
CREATE TYPE "LobbyFormat" AS ENUM ('PICKUP', 'TOURNAMENT');

-- DropIndex
DROP INDEX "LobbyPlayer_lobbyId_idx";

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "format" "LobbyFormat" NOT NULL DEFAULT 'PICKUP';

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_lobbyId_name_key" ON "Team"("lobbyId", "name");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
