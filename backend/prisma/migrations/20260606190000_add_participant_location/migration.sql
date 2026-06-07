-- CreateTable
CREATE TABLE "ParticipantLocation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantLocation_tripId_idx" ON "ParticipantLocation"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantLocation_tripId_userId_key" ON "ParticipantLocation"("tripId", "userId");

-- AddForeignKey
ALTER TABLE "ParticipantLocation" ADD CONSTRAINT "ParticipantLocation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantLocation" ADD CONSTRAINT "ParticipantLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
