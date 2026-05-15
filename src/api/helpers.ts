import type { Context } from "hono";
import { ApiError } from "../contract/errors.js";
import type { MutationOptions } from "../domain/shared.js";

export function readMutationOptions(c: Context): MutationOptions {
  const opts: MutationOptions = {};
  const idem = c.req.header("idempotency-key");
  const intent = c.req.header("x-agent-intent");
  const dry = c.req.query("dry_run");
  if (idem) opts.idempotencyKey = idem;
  if (intent) opts.intent = intent;
  if (dry === "1" || dry === "true") opts.dryRun = true;
  return opts;
}

export function parseOrThrow<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string; path: (string | number)[] }[] } } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path.join(".");
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: first?.message ?? "Validation failed",
      ...(field ? { field } : {}),
    });
  }
  return parsed.data;
}
