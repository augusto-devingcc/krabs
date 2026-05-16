import { z } from "zod";
import { idSchema } from "../ids.js";

export const apiKeySchema = z.object({
  id: idSchema("apiKey"),
  accountId: idSchema("account"),
  label: z.string(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;

export const apiKeyPlaintextPrefix = "krabs_sk_" as const;
export const apiKeyPlaintextRegex = /^krabs_sk_[A-Za-z0-9_-]{32,}$/;
