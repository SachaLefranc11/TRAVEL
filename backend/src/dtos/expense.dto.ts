import { z } from 'zod';

export const ShareInputDTO = z.object({
  userId: z.string().min(1),
  amount: z.number().nonnegative(),
});

export const CreateExpenseDTO = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  category: z.enum(['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'OTHER']),
  date: z.string().datetime(),
  notes: z.string().max(300).optional(),
  // Qui a payé (par défaut l'utilisateur courant, résolu côté contrôleur)
  paidById: z.string().optional(),
  // PERSONAL = dépense perso (non partagée) · EQUAL = parts égales · CUSTOM = montants manuels
  splitType: z.enum(['PERSONAL', 'EQUAL', 'CUSTOM']).default('EQUAL'),
  // EQUAL : sous-ensemble de participants concernés (défaut = tous)
  participantIds: z.array(z.string()).optional(),
  // CUSTOM : montant dû par participant (doit sommer au total)
  shares: z.array(ShareInputDTO).optional(),
});

export const UpdateExpenseDTO = CreateExpenseDTO.partial();

export type CreateExpenseInput = z.infer<typeof CreateExpenseDTO>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseDTO>;
export type ShareInput = z.infer<typeof ShareInputDTO>;
