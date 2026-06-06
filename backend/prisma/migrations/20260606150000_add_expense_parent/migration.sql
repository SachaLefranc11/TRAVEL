-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "parentExpenseId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_parentExpenseId_idx" ON "Expense"("parentExpenseId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_parentExpenseId_fkey" FOREIGN KEY ("parentExpenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
