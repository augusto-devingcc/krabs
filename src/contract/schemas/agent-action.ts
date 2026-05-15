import { z } from "zod";
import { idSchema } from "../ids.js";

export const targetKindSchema = z.enum([
  "account",
  "api_key",
  "contact",
  "identity",
  "deal",
  "task",
  "note",
  "tag",
  "contact_tag",
  "interaction",
]);

export const operationSchema = z.string().regex(/^[a-z_]+\.[a-z_]+$/, {
  message: "operation must look like 'contact.create'",
});

export const agentActionSchema = z.object({
  id: idSchema("agentAction"),
  accountId: idSchema("account"),
  apiKeyId: idSchema("apiKey"),
  operation: operationSchema,
  targetKind: targetKindSchema,
  targetId: z.string(),
  intent: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export type AgentAction = z.infer<typeof agentActionSchema>;
