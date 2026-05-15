import { z } from "zod";
import { idSchema } from "../ids.js";
import { contactStatuses } from "../../db/schema.js";

export const contactStatusSchema = z.enum(contactStatuses);

export const contactSchema = z.object({
  id: idSchema("contact"),
  accountId: idSchema("account"),
  name: z.string(),
  primaryEmail: z.string().email().nullable(),
  primaryPhone: z.string().nullable(),
  status: contactStatusSchema,
  customFields: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const contactCreateInputSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(3).max(50).optional(),
  status: contactStatusSchema.default("lead"),
  customFields: z.record(z.unknown()).optional(),
});

export const contactUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  primaryEmail: z.string().trim().email().nullable().optional(),
  primaryPhone: z.string().trim().min(3).max(50).nullable().optional(),
  status: contactStatusSchema.optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export const contactListFiltersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  status: contactStatusSchema.optional(),
  q: z.string().min(1).optional(),
  updatedSince: z.string().datetime().optional(),
});

export type Contact = z.infer<typeof contactSchema>;
export type ContactCreateInput = z.infer<typeof contactCreateInputSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateInputSchema>;
export type ContactListFilters = z.infer<typeof contactListFiltersSchema>;
