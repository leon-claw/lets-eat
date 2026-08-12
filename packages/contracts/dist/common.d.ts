import { z } from 'zod';
export declare const UuidSchema: z.ZodString;
export declare const RevisionSchema: z.ZodNumber;
export declare const DatasetTypeSchema: z.ZodEnum<{
    large: "large";
    small: "small";
}>;
export declare const DecisionSchema: z.ZodEnum<{
    liked: "liked";
    disliked: "disliked";
}>;
export declare const RoomStatusSchema: z.ZodEnum<{
    waiting: "waiting";
    playing: "playing";
    results: "results";
}>;
export declare const RoundStatusSchema: z.ZodEnum<{
    playing: "playing";
    completed: "completed";
}>;
export declare const RoundMemberStatusSchema: z.ZodEnum<{
    completed: "completed";
    choosing: "choosing";
    removed: "removed";
}>;
export declare const ApiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    requestId: z.ZodString;
    latest: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strict>;
export type DatasetType = z.infer<typeof DatasetTypeSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type RoomStatus = z.infer<typeof RoomStatusSchema>;
export type RoundStatus = z.infer<typeof RoundStatusSchema>;
export type RoundMemberStatus = z.infer<typeof RoundMemberStatusSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;
