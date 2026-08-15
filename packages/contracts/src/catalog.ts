import { z } from 'zod';
import { DatasetTypeSchema } from './common.js';

export const CatalogItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(40),
  description: z.string().min(1).max(240),
  imageUrl: z.string().max(500),
  datasetType: DatasetTypeSchema,
  order: z.number().int().positive(),
  tags: z.array(z.string().min(1)).max(5),
  representativeFoods: z.array(z.string().min(1)).max(5),
  cuisineTags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(3).optional(),
}).strict();

export const CatalogDocumentSchema = z.object({
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  items: z.array(CatalogItemSchema).min(1),
}).strict();

export const CatalogManifestSchema = z.object({
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  catalogUrl: z.string().min(1),
  counts: z.object({
    large: z.number().int().nonnegative(),
    small: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const GetCatalogManifestResponseSchema = CatalogManifestSchema;
export const GetCatalogResponseSchema = CatalogDocumentSchema;

export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type CatalogDocument = z.infer<typeof CatalogDocumentSchema>;
export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;
