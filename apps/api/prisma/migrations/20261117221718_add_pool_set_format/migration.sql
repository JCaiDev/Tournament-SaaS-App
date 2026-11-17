-- CreateEnum
CREATE TYPE "SetMode" AS ENUM ('PLAY_ALL', 'BEST_OF');

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "poolSetMode" "SetMode" NOT NULL DEFAULT 'PLAY_ALL',
ADD COLUMN     "poolSets" INTEGER NOT NULL DEFAULT 1;
