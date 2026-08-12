import { z } from 'zod';
import { UuidSchema } from './common.js';

export const AnonymousAuthResponseSchema = z.object({
  userId: UuidSchema,
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
}).strict();

export type AnonymousAuthResponse = z.infer<typeof AnonymousAuthResponseSchema>;
