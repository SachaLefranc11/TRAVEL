import { z } from 'zod';

export const CreateSettlementDTO = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
});

export type CreateSettlementInput = z.infer<typeof CreateSettlementDTO>;
