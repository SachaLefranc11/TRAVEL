-- CreateTable
CREATE TABLE "PlannerActivity" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerActivity_tripId_idx" ON "PlannerActivity"("tripId");

-- AddForeignKey
ALTER TABLE "PlannerActivity" ADD CONSTRAINT "PlannerActivity_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerActivity" ADD CONSTRAINT "PlannerActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
