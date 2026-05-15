import { z } from "zod";
import { idSchema } from "../ids.js";

export const tagSchema = z.object({
  id: idSchema("tag"),
  accountId: idSchema("account"),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const tagCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "color must be a hex like #aabbcc")
    .optional(),
});

export const tagUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
});

export const tagAttachInputSchema = z.object({
  contactId: idSchema("contact"),
  tagId: idSchema("tag"),
});

export type Tag = z.infer<typeof tagSchema>;
export type TagCreateInput = z.infer<typeof tagCreateInputSchema>;
export type TagUpdateInput = z.infer<typeof tagUpdateInputSchema>;
export type TagAttachInput = z.infer<typeof tagAttachInputSchema>;
