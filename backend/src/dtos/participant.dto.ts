import { z } from 'zod';

export const InviteParticipantDTO = z.object({
  email: z.string().email(),
});

export type InviteParticipantInput = z.infer<typeof InviteParticipantDTO>;
