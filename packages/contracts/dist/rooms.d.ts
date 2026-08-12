import { z } from 'zod';
export declare const RoomMemberSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    displayName: z.ZodString;
    role: z.ZodEnum<{
        host: "host";
        guest: "guest";
    }>;
    joinedAt: z.ZodString;
}, z.core.$strict>;
export declare const RoomSnapshotSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    hostUserId: z.ZodString;
    selectedDataset: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        waiting: "waiting";
        playing: "playing";
        results: "results";
    }>;
    currentRoundId: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CurrentRoomResponseSchema: z.ZodObject<{
    room: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        hostUserId: z.ZodString;
        selectedDataset: z.ZodEnum<{
            large: "large";
            small: "small";
        }>;
        status: z.ZodEnum<{
            waiting: "waiting";
            playing: "playing";
            results: "results";
        }>;
        currentRoundId: z.ZodNullable<z.ZodString>;
        revision: z.ZodNumber;
        members: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            userId: z.ZodString;
            displayName: z.ZodString;
            role: z.ZodEnum<{
                host: "host";
                guest: "guest";
            }>;
            joinedAt: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CreateRoomRequestSchema: z.ZodObject<{
    displayName: z.ZodString;
}, z.core.$strict>;
export declare const JoinRoomRequestSchema: z.ZodObject<{
    code: z.ZodString;
    displayName: z.ZodString;
    replaceCurrentRoom: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const ChangeDatasetRequestSchema: z.ZodObject<{
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    expectedRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const OpenNextRoundRequestSchema: z.ZodObject<{
    expectedRoomRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const CreateRoomResponseSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    hostUserId: z.ZodString;
    selectedDataset: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        waiting: "waiting";
        playing: "playing";
        results: "results";
    }>;
    currentRoundId: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const JoinRoomResponseSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    hostUserId: z.ZodString;
    selectedDataset: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        waiting: "waiting";
        playing: "playing";
        results: "results";
    }>;
    currentRoundId: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const GetRoomResponseSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    hostUserId: z.ZodString;
    selectedDataset: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        waiting: "waiting";
        playing: "playing";
        results: "results";
    }>;
    currentRoundId: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const ChangeDatasetResponseSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    hostUserId: z.ZodString;
    selectedDataset: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        waiting: "waiting";
        playing: "playing";
        results: "results";
    }>;
    currentRoundId: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const OpenNextRoundResponseSchema: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    hostUserId: z.ZodString;
    selectedDataset: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        waiting: "waiting";
        playing: "playing";
        results: "results";
    }>;
    currentRoundId: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        displayName: z.ZodString;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
        joinedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type RoomMember = z.infer<typeof RoomMemberSchema>;
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;
export type CurrentRoomResponse = z.infer<typeof CurrentRoomResponseSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type ChangeDatasetRequest = z.infer<typeof ChangeDatasetRequestSchema>;
export type OpenNextRoundRequest = z.infer<typeof OpenNextRoundRequestSchema>;
