import { z } from 'zod';

export const PositionDTO = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type PositionInput = z.infer<typeof PositionDTO>;
