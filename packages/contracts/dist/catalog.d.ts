import { z } from 'zod';
export declare const CatalogItemSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    imageUrl: z.ZodString;
    datasetType: z.ZodEnum<{
        large: "large";
        small: "small";
    }>;
    order: z.ZodNumber;
    tags: z.ZodArray<z.ZodString>;
    representativeFoods: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const CatalogDocumentSchema: z.ZodObject<{
    catalogVersion: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        imageUrl: z.ZodString;
        datasetType: z.ZodEnum<{
            large: "large";
            small: "small";
        }>;
        order: z.ZodNumber;
        tags: z.ZodArray<z.ZodString>;
        representativeFoods: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CatalogManifestSchema: z.ZodObject<{
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    catalogUrl: z.ZodString;
    counts: z.ZodObject<{
        large: z.ZodNumber;
        small: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const GetCatalogManifestResponseSchema: z.ZodObject<{
    catalogVersion: z.ZodString;
    catalogHash: z.ZodString;
    catalogUrl: z.ZodString;
    counts: z.ZodObject<{
        large: z.ZodNumber;
        small: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const GetCatalogResponseSchema: z.ZodObject<{
    catalogVersion: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        imageUrl: z.ZodString;
        datasetType: z.ZodEnum<{
            large: "large";
            small: "small";
        }>;
        order: z.ZodNumber;
        tags: z.ZodArray<z.ZodString>;
        representativeFoods: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type CatalogDocument = z.infer<typeof CatalogDocumentSchema>;
export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;
