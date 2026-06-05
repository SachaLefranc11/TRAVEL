-- CreateTable
CREATE TABLE "ActivityCache" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "activities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCache_destination_key" ON "ActivityCache"("destination");
