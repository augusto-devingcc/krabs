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
// Accept both new (krabs_sk_) and legacy (crm_live_) prefixes — tokens issued
// before the 2026-05 rebrand still hash-match in the DB and shouldn't be
// invalidated just by shape. Only `krabs_sk_` is generated going forward.
export const apiKeyPlaintextRegex = /^(?:krabs_sk_|crm_live_)[A-Za-z0-9_-]{32,}$/;
