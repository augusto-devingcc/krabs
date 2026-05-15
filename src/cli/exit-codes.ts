export const ExitCode = {
  SUCCESS: 0,
  UNKNOWN: 1,
  VALIDATION: 2,
  NOT_FOUND: 3,
  CONFLICT: 4,
  AUTH: 5,
  RATE_LIMITED: 6,
} as const;

export function codeToExit(code: string): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return ExitCode.VALIDATION;
    case "NOT_FOUND":
      return ExitCode.NOT_FOUND;
    case "CONFLICT":
    case "IDEMPOTENCY_CONFLICT":
      return ExitCode.CONFLICT;
    case "UNAUTHENTICATED":
    case "INVALID_API_KEY":
      return ExitCode.AUTH;
    case "RATE_LIMITED":
      return ExitCode.RATE_LIMITED;
    default:
      return ExitCode.UNKNOWN;
  }
}
