-- CreateTable
CREATE TABLE "MatchSet" (
    "id" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "teamAPoints" INTEGER NOT NULL,
    "teamBPoints" INTEGER NOT NULL,
    "matchId" TEXT NOT NULL,

    CONSTRAINT "MatchSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSet_matchId_setNumber_key" ON "MatchSet"("matchId", "setNumber");

-- AddForeignKey
ALTER TABLE "MatchSet" ADD CONSTRAINT "MatchSet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
