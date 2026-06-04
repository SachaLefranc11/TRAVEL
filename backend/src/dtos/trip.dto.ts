import { z } from 'zod';

export const CreateTripDTO = z.object({
  title: z.string().min(1).max(100),
  destination: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  description: z.string().max(500).optional(),
  coverImage: z.string().url().optional(),
});

export const UpdateTripDTO = CreateTripDTO.partial();

export const CreateLocationDTO = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['ATTRACTION', 'RESTAURANT', 'HOTEL', 'ACTIVITY', 'OTHER']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(500).optional(),
  address: z.string().max(300).optional(),
});

export type CreateTripInput = z.infer<typeof CreateTripDTO>;
export type UpdateTripInput = z.infer<typeof UpdateTripDTO>;
export type CreateLocationInput = z.infer<typeof CreateLocationDTO>;
