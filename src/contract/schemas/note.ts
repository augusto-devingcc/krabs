import { z } from "zod";
import { idSchema } from "../ids.js";

export const noteSchema = z.object({
  id: idSchema("note"),
  accountId: idSchema("account"),
  contactId: idSchema("contact").nullable(),
  dealId: idSchema("deal").nullable(),
  title: z.string().nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const noteCreateInputSchema = z.object({
  body: z.string().trim().min(1).max(500_000),
  title: z.string().trim().max(500).optional(),
  contactId: idSchema("contact").optional(),
  dealId: idSchema("deal").optional(),
});

export const noteUpdateInputSchema = z.object({
  body: z.string().trim().min(1).max(500_000).optional(),
  title: z.string().trim().max(500).nullable().optional(),
  contactId: idSchema("contact").nullable().optional(),
  dealId: idSchema("deal").nullable().optional(),
});

export const noteListFiltersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  contactId: idSchema("contact").optional(),
  dealId: idSchema("deal").optional(),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateInputSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateInputSchema>;
export type NoteListFilters = z.infer<typeof noteListFiltersSchema>;
