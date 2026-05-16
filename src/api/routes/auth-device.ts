import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  consumeApprovedDeviceAuth,
  createDeviceAuthorization,
  expireOldDeviceAuthorizations,
  findByDeviceCode,
  isExpired,
  type ClientMeta,
} from "../../domain/device-auth.js";

export const authDeviceRoute = new Hono();

const FALLBACK_VERIFICATION_ORIGIN = "https://krabs.dev";

type OAuthErrorCode =
  | "invalid_request"
  | "invalid_grant"
  | "unsupported_grant_type"
  | "authorization_pending"
  | "access_denied"
  | "expired_token"
  | "token_already_issued";

function oauthError(code: OAuthErrorCode, description: string, status: ContentfulStatusCode) {
  return { body: { error: code, error_description: description }, status };
}

function parseClientMetaJson(raw: string | null): { clientName?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.clientName === "string") {
      return { clientName: parsed.clientName };
    }
  } catch {
    return {};
  }
  return {};
}

authDeviceRoute.post("/device", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const clientName = typeof body.client_name === "string" ? body.client_name : undefined;
  const userAgent = c.req.header("user-agent") ?? undefined;
  const ip = c.req.header("x-forwarded-for") ?? "unknown";

  const clientMeta: ClientMeta = {};
  if (clientName !== undefined) clientMeta.clientName = clientName;
  if (userAgent !== undefined) clientMeta.userAgent = userAgent;
  clientMeta.ip = ip;

  const result = await createDeviceAuthorization(clientMeta);

  const origin = c.req.header("origin") ?? FALLBACK_VERIFICATION_ORIGIN;
  const verificationUri = `${origin}/device`;
  const verificationUriComplete = `${verificationUri}?code=${encodeURIComponent(result.userCode)}`;

  return c.json({
    device_code: result.deviceCode,
    user_code: result.userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    expires_in: result.expiresIn,
    interval: result.interval,
  });
});

authDeviceRoute.post("/token", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const grantType = typeof body.grant_type === "string" ? body.grant_type : undefined;
  const deviceCode = typeof body.device_code === "string" ? body.device_code : undefined;

  const isValidGrantType =
    grantType === "device_code" ||
    grantType === "urn:ietf:params:oauth:grant-type:device_code";

  if (!isValidGrantType) {
    const err = oauthError(
      "unsupported_grant_type",
      "grant_type must be device_code",
      400,
    );
    return c.json(err.body, err.status);
  }

  if (!deviceCode) {
    const err = oauthError("invalid_request", "device_code is required", 400);
    return c.json(err.body, err.status);
  }

  await expireOldDeviceAuthorizations();

  const row = await findByDeviceCode(deviceCode);
  if (!row) {
    const err = oauthError("invalid_grant", "Unknown device_code", 404);
    return c.json(err.body, err.status);
  }

  if (row.status === "pending" && isExpired(row)) {
    const err = oauthError("expired_token", "Device code has expired", 410);
    return c.json(err.body, err.status);
  }

  switch (row.status) {
    case "pending": {
      const err = oauthError(
        "authorization_pending",
        "User has not yet approved the authorization",
        428,
      );
      return c.json(err.body, err.status);
    }
    case "denied": {
      const err = oauthError("access_denied", "User denied the authorization", 403);
      return c.json(err.body, err.status);
    }
    case "expired": {
      const err = oauthError("expired_token", "Device code has expired", 410);
      return c.json(err.body, err.status);
    }
    case "approved": {
      const meta = parseClientMetaJson(row.clientMeta);
      const label = meta.clientName?.trim() || "Authorized device";
      // Race-safe: only the first poll wins the UPDATE...WHERE approvedApiKeyId IS NULL
      // claim; subsequent polls get null here and must surface token_already_issued.
      const consumed = await consumeApprovedDeviceAuth({
        deviceAuthorizationId: row.id,
        label,
      });
      if (!consumed) {
        const err = oauthError(
          "token_already_issued",
          "An access token has already been issued for this device_code",
          403,
        );
        return c.json(err.body, err.status);
      }
      return c.json({
        access_token: consumed.accessToken,
        token_type: "bearer",
        account_id: consumed.accountId,
      });
    }
    default: {
      const err = oauthError("invalid_grant", "Unknown authorization state", 400);
      return c.json(err.body, err.status);
    }
  }
});
