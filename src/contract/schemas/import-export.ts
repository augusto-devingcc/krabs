import { z } from "zod";
import { contactStatusSchema } from "./contact.js";

export const csvColumnMapSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    status: z.string().optional(),
  })
  .strict();

export const contactImportCsvInputSchema = z.object({
  csv: z.string().min(1).max(20_000_000),
  columnMap: csvColumnMapSchema.optional(),
  defaultStatus: contactStatusSchema.optional(),
  // When the row's email/phone identity collides with an existing contact:
  // 'skip' (default) — leave the row out
  // 'link' — do not create a new contact; attach the OTHER identities from
  //          the row to the existing contact (no-op if there are no other identities)
  onConflict: z.enum(["skip", "link"]).optional(),
});

export type ContactImportCsvInput = z.infer<typeof contactImportCsvInputSchema>;

export const vcardIngestInputSchema = z.object({
  vcard: z.string().min(1).max(1_000_000),
  createContactIfMissing: z.boolean().optional(),
});

export type VCardIngestInput = z.infer<typeof vcardIngestInputSchema>;

export const exportAccountFiltersSchema = z.object({
  since: z.string().datetime().optional(),
  includeActions: z.boolean().optional(),
});

export type ExportAccountFilters = z.infer<typeof exportAccountFiltersSchema>;
