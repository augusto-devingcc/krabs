import { z } from "zod";
import { idSchema } from "../ids.js";
import { interactionKinds, interactionDirections } from "../../db/schema.js";

export const interactionKindSchema = z.enum(interactionKinds);
export const interactionDirectionSchema = z.enum(interactionDirections);

export const interactionSchema = z.object({
  id: idSchema("interaction"),
  accountId: idSchema("account"),
  contactId: idSchema("contact").nullable(),
  kind: interactionKindSchema,
  direction: interactionDirectionSchema.nullable(),
  source: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type Interaction = z.infer<typeof interactionSchema>;

export const interactionCreateInputSchema = z.object({
  contactId: idSchema("contact").optional(),
  kind: interactionKindSchema,
  direction: interactionDirectionSchema.optional(),
  source: z.string().min(1).max(200).optional(),
  subject: z.string().max(1000).optional(),
  body: z.string().max(100_000).optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

export type InteractionCreateInput = z.infer<typeof interactionCreateInputSchema>;

export const interactionListFiltersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  contactId: idSchema("contact").optional(),
  kind: interactionKindSchema.optional(),
  since: z.string().datetime().optional(),
});

export type InteractionListFilters = z.infer<typeof interactionListFiltersSchema>;

// Email ingest — pre-parsed JSON shape. The caller (agent or upstream
// pipeline) extracts these fields from a raw .eml; socrm stays focused on
// data, not on MIME parsing.
export const emailIngestInputSchema = z.object({
  from: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email(),
  }),
  to: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().email(),
      }),
    )
    .optional(),
  subject: z.string().max(1000).optional(),
  body: z.string().max(500_000).optional(),
  receivedAt: z.string().datetime().optional(),
  messageId: z.string().max(500).optional(),
  direction: interactionDirectionSchema.optional(),
  source: z.string().max(200).optional(),
  createContactIfMissing: z.boolean().optional(),
});

export type EmailIngestInput = z.infer<typeof emailIngestInputSchema>;