import { z } from "zod";

export const SCHEMA_VERSION = "1" as const;

export function successEnvelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    data,
    _schema_version: z.literal(SCHEMA_VERSION),
  });
}

export function wrap<T>(data: T): { data: T; _schema_version: typeof SCHEMA_VERSION } {
  return { data, _schema_version: SCHEMA_VERSION };
}
