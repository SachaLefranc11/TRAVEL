import { z } from 'zod';

const timeField = z.string().regex(/^\d{2}:\d{2}$/, 'Heure au format HH:MM').optional();

export const CreatePlannerActivityDTO = z.object({
  date: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  startTime: timeField,
  endTime: timeField,
  location: z.string().max(200).optional(),
});

export const UpdatePlannerActivityDTO = CreatePlannerActivityDTO.partial();

export type CreatePlannerActivityInput = z.infer<typeof CreatePlannerActivityDTO>;
export type UpdatePlannerActivityInput = z.infer<typeof UpdatePlannerActivityDTO>;
