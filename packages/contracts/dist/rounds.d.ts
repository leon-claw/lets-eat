import { z } from 'zod';
export declare const StartRoundRequestSchema: z.ZodObject<{
    expectedRoomRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const CompleteRoundRequestSchema: z.ZodObject<{
    expectedRoundRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const RemoveRoundMemberRequestSchema: z.ZodObject<{
    expectedRoundRevision: z.ZodNumber;
}, z.core.$strict>;
export declare const PutDecisionRequestSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        liked: "liked";
        disliked: "disliked";
    }>;
}, z.core.$strict>;
export declare const OwnDecisionSchema: z.ZodObject<{
    catalogItemId: z.ZodString;
    decision: z.ZodEnum<{
        liked: "liked";
        disliked: "disliked";
    }>;
    updatedAt: z.ZodString;
}, z.core.$strict>;
export declare const RoundMemberSchema: z.ZodObject<{
    memberId: z.ZodString;
    displayName: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        choosing: "choosing";
        removed: "removed";
    }>;
    isSelf: z.ZodBoolean;
    role: z.ZodEnum<{
        host: "host";
        guest: "guest";
    }>;
}, z.core.$strict>;
export declare const RoundSnapshotSchema: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    sequence: z.ZodNumber;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        playing: "playing";
        completed: "completed";
    }>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        displayName: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            choosing: "choosing";
            removed: "removed";
        }>;
        isSelf: z.ZodBoolean;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
    }, z.core.$strict>>;
    ownDecisions: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        decision: z.ZodEnum<{
            liked: "liked";
            disliked: "disliked";
        }>;
        updatedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const ResultItemSchema: z.ZodObject<{
    catalogItemId: z.ZodString;
    likeCount: z.ZodNumber;
    order: z.ZodNumber;
}, z.core.$strict>;
export declare const RoundResultSchema: z.ZodObject<{
    roundId: z.ZodString;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    items: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        likeCount: z.ZodNumber;
        order: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const StartRoundResponseSchema: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    sequence: z.ZodNumber;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        playing: "playing";
        completed: "completed";
    }>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        displayName: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            choosing: "choosing";
            removed: "removed";
        }>;
        isSelf: z.ZodBoolean;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
    }, z.core.$strict>>;
    ownDecisions: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        decision: z.ZodEnum<{
            liked: "liked";
            disliked: "disliked";
        }>;
        updatedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const GetRoundResponseSchema: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    sequence: z.ZodNumber;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        playing: "playing";
        completed: "completed";
    }>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        displayName: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            choosing: "choosing";
            removed: "removed";
        }>;
        isSelf: z.ZodBoolean;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
    }, z.core.$strict>>;
    ownDecisions: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        decision: z.ZodEnum<{
            liked: "liked";
            disliked: "disliked";
        }>;
        updatedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CompleteRoundResponseSchema: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    sequence: z.ZodNumber;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        playing: "playing";
        completed: "completed";
    }>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        displayName: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            choosing: "choosing";
            removed: "removed";
        }>;
        isSelf: z.ZodBoolean;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
    }, z.core.$strict>>;
    ownDecisions: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        decision: z.ZodEnum<{
            liked: "liked";
            disliked: "disliked";
        }>;
        updatedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const RemoveRoundMemberResponseSchema: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    sequence: z.ZodNumber;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    status: z.ZodEnum<{
        playing: "playing";
        completed: "completed";
    }>;
    revision: z.ZodNumber;
    members: z.ZodArray<z.ZodObject<{
        memberId: z.ZodString;
        displayName: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            choosing: "choosing";
            removed: "removed";
        }>;
        isSelf: z.ZodBoolean;
        role: z.ZodEnum<{
            host: "host";
            guest: "guest";
        }>;
    }, z.core.$strict>>;
    ownDecisions: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        decision: z.ZodEnum<{
            liked: "liked";
            disliked: "disliked";
        }>;
        updatedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const GetRoundResultResponseSchema: z.ZodObject<{
    roundId: z.ZodString;
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    items: z.ZodArray<z.ZodObject<{
        catalogItemId: z.ZodString;
        likeCount: z.ZodNumber;
        order: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type StartRoundRequest = z.infer<typeof StartRoundRequestSchema>;
export type CompleteRoundRequest = z.infer<typeof CompleteRoundRequestSchema>;
export type RemoveRoundMemberRequest = z.infer<typeof RemoveRoundMemberRequestSchema>;
export type PutDecisionRequest = z.infer<typeof PutDecisionRequestSchema>;
export type OwnDecision = z.infer<typeof OwnDecisionSchema>;
export type RoundMember = z.infer<typeof RoundMemberSchema>;
export type RoundSnapshot = z.infer<typeof RoundSnapshotSchema>;
export type ResultItem = z.infer<typeof ResultItemSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
