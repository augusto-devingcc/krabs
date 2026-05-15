import type { ErrorHandler } from "hono";
import { ApiError } from "@/contract/errors.js";
import { logger } from "@/lib/logger.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(err.toResponse(), err.status as 400 | 401 | 404 | 409 | 429 | 500);
  }

  logger.error({ err }, "unhandled error");
  const internal = new ApiError({
    code: "INTERNAL",
    message: "Internal server error",
  });
  return c.json(internal.toResponse(), 500);
};
