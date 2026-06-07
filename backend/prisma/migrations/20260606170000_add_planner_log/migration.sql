-- CreateTable
CREATE TABLE "PlannerActivityLog" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "activityId" TEXT,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityTitle" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerActivityLog_tripId_idx" ON "PlannerActivityLog"("tripId");

-- AddForeignKey
ALTER TABLE "PlannerActivityLog" ADD CONSTRAINT "PlannerActivityLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerActivityLog" ADD CONSTRAINT "PlannerActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
