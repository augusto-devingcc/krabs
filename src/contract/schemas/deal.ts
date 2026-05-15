import { z } from "zod";
import { idSchema } from "../ids.js";
import { dealStatuses } from "../../db/schema.js";

export const dealStatusSchema = z.enum(dealStatuses);

export const dealSchema = z.object({
  id: idSchema("deal"),
  accountId: idSchema("account"),
  contactId: idSchema("contact").nullable(),
  title: z.string(),
  stage: z.string(),
  status: dealStatusSchema,
  value: z.number().int().nullable(),
  currency: z.string().nullable(),
  expectedCloseDate: z.string().nullable(),
  customFields: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const dealCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  contactId: idSchema("contact").optional(),
  stage: z.string().trim().min(1).max(50).optional(),
  status: dealStatusSchema.optional(),
  value: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const dealUpdateInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  contactId: idSchema("contact").nullable().optional(),
  stage: z.string().trim().min(1).max(50).optional(),
  status: dealStatusSchema.optional(),
  value: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export const dealListFiltersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  contactId: idSchema("contact").optional(),
  stage: z.string().optional(),
  status: dealStatusSchema.optional(),
});

export type Deal = z.infer<typeof dealSchema>;
export type DealCreateInput = z.infer<typeof dealCreateInputSchema>;
export type DealUpdateInput = z.infer<typeof dealUpdateInputSchema>;
export type DealListFilters = z.infer<typeof dealListFiltersSchema>;
