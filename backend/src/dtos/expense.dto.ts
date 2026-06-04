import { z } from 'zod';

export const CreateExpenseDTO = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  category: z.enum(['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'OTHER']),
  date: z.string().datetime(),
  notes: z.string().max(300).optional(),
});

export const UpdateExpenseDTO = CreateExpenseDTO.partial();

export type CreateExpenseInput = z.infer<typeof CreateExpenseDTO>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseDTO>;
