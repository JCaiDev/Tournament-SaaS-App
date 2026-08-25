/*
  Warnings:

  - You are about to drop the column `cost` on the `Lobby` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Lobby` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Lobby` table. All the data in the column will be lost.
  - Added the required column `allowToApply` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Added the required column `genderFormat` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lobbyName` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skillLevel` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Lobby` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('OPEN', 'INTERMEDIATE', 'INTERMEDIATE_PLUS');

-- CreateEnum
CREATE TYPE "GenderFormat" AS ENUM ('MENS', 'WOMENS', 'COED');

-- AlterTable
ALTER TABLE "Lobby" DROP COLUMN "cost",
DROP COLUMN "date",
DROP COLUMN "title",
ADD COLUMN     "allowToApply" BOOLEAN NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "genderFormat" "GenderFormat" NOT NULL,
ADD COLUMN     "lobbyName" TEXT NOT NULL,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "skillLevel" "SkillLevel" NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;
