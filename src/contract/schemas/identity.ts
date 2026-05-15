import { z } from "zod";
import { idSchema } from "../ids.js";
import { identityKinds } from "../../db/schema.js";

export const identityKindSchema = z.enum(identityKinds);

export const identitySchema = z.object({
  id: idSchema("identity"),
  accountId: idSchema("account"),
  contactId: idSchema("contact"),
  kind: identityKindSchema,
  value: z.string(),
  confidence: z.number().int().min(0).max(100),
  createdAt: z.string().datetime(),
});

export type Identity = z.infer<typeof identitySchema>;

export const identityAddInputSchema = z.object({
  contactId: idSchema("contact"),
  kind: identityKindSchema,
  value: z.string().trim().min(1).max(500),
  confidence: z.number().int().min(0).max(100).optional(),
});

export const identityFindInputSchema = z.object({
  kind: identityKindSchema,
  value: z.string().trim().min(1).max(500),
});

export type IdentityAddInput = z.infer<typeof identityAddInputSchema>;
export type IdentityFindInput = z.infer<typeof identityFindInputSchema>;
