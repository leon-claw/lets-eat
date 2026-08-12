import { z } from 'zod';
export declare const AnonymousAuthResponseSchema: z.ZodObject<{
    userId: z.ZodString;
    token: z.ZodString;
    expiresAt: z.ZodString;
}, z.core.$strict>;
export type AnonymousAuthResponse = z.infer<typeof AnonymousAuthResponseSchema>;
