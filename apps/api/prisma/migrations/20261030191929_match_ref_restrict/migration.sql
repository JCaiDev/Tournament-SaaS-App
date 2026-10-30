-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_refTeamId_fkey";

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refTeamId_fkey" FOREIGN KEY ("refTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
