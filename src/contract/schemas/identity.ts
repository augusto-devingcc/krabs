import { z } from "zod";
import { idSchema } from "../ids.js";
import { identityKinds } from "@/db/schema.js";

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
