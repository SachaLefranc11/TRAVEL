import { z } from 'zod';

export const ActivitySuggestionDTO = z.object({
  name: z.string(),
  description: z.string(),
  address: z.string().optional(),
  category: z.enum(['ATTRACTION', 'RESTAURANT', 'HOTEL', 'ACTIVITY', 'OTHER']),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const ActivitiesResponseDTO = z.object({
  destination: z.string(),
  activities: z.array(ActivitySuggestionDTO),
});

export const GeocodeResponseDTO = z.object({
  lat: z.number(),
  lng: z.number(),
  displayName: z.string(),
  zoom: z.number(),
});

export type ActivitySuggestion = z.infer<typeof ActivitySuggestionDTO>;
export type ActivitiesResponse = z.infer<typeof ActivitiesResponseDTO>;
export type GeocodeResponse = z.infer<typeof GeocodeResponseDTO>;
