import { z } from "zod";

export const ErrorCode = {
  // 400-class
  VALIDATION_FAILED: "VALIDATION_FAILED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  // 401/403
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_API_KEY: "INVALID_API_KEY",
  // 404
  NOT_FOUND: "NOT_FOUND",
  // 409
  CONFLICT: "CONFLICT",
  // 429
  RATE_LIMITED: "RATE_LIMITED",
  // 500
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const errorBodySchema = z.object({
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
  hint: z.string().optional(),
  field: z.string().optional(),
});

export const errorResponseSchema = z.object({
  error: errorBodySchema,
  _schema_version: z.literal("1"),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

const codeToStatus: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  IDEMPOTENCY_CONFLICT: 409,
  UNAUTHENTICATED: 401,
  INVALID_API_KEY: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly hint?: string;
  readonly field?: string;

  constructor(args: { code: ErrorCode; message: string; hint?: string; field?: string }) {
    super(args.message);
    this.code = args.code;
    this.status = codeToStatus[args.code];
    if (args.hint !== undefined) this.hint = args.hint;
    if (args.field !== undefined) this.field = args.field;
  }

  toResponse(): ErrorResponse {
    const error: ErrorBody = { code: this.code, message: this.message };
    if (this.hint !== undefined) error.hint = this.hint;
    if (this.field !== undefined) error.field = this.field;
    return { error, _schema_version: "1" };
  }
}
