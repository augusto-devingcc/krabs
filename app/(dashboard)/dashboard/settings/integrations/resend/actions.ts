"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "../../../../../../src/lib/web/dashboard-ctx.js";
import {
  connectResend,
  disconnectResend,
} from "../../../../../../src/integrations/resend/connect.js";
import {
  addDomain,
  removeDomain,
  verifyDomain,
} from "../../../../../../src/integrations/resend/domains.js";
import { sendEmail } from "../../../../../../src/integrations/resend/send.js";
import { ApiError } from "../../../../../../src/contract/errors.js";

const ROUTE = "/dashboard/settings/integrations/resend";

export async function connectResendAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const secretKey = formData.get("secretKey")?.toString().trim() ?? "";
  const displayNameRaw = formData.get("displayName")?.toString().trim() ?? "";
  const displayName = displayNameRaw || "Resend";

  if (!secretKey) return { error: "Resend API key is required." };
  if (!secretKey.startsWith("re_")) {
    return { error: "Key must start with re_." };
  }

  const { ctx } = await getDashboardContext();
  try {
    await connectResend(ctx, { secretKey, displayName });
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to connect." };
  }
}

export async function disconnectResendAction(): Promise<
  { ok: true } | { error: string }
> {
  const { ctx } = await getDashboardContext();
  try {
    await disconnectResend(ctx);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return {
      error: err instanceof Error ? err.message : "Failed to disconnect.",
    };
  }
}

export async function addDomainAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const domain = formData.get("domain")?.toString().trim().toLowerCase() ?? "";
  if (!domain) return { error: "Domain is required." };

  const { ctx } = await getDashboardContext();
  try {
    await addDomain(ctx, { domain });
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to add domain." };
  }
}

export async function verifyDomainAction(
  domainId: string,
): Promise<{ ok: true; verified: boolean } | { error: string }> {
  const { ctx } = await getDashboardContext();
  try {
    const r = await verifyDomain(ctx, domainId);
    revalidatePath(ROUTE);
    return { ok: true, verified: r.domain.status === "verified" };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to verify domain." };
  }
}

export async function removeDomainAction(
  domainId: string,
): Promise<{ ok: true } | { error: string }> {
  const { ctx } = await getDashboardContext();
  try {
    await removeDomain(ctx, domainId);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to remove domain." };
  }
}

export async function sendTestEmailAction(
  formData: FormData,
): Promise<{ ok: true; messageId: string } | { error: string }> {
  const to = formData.get("to")?.toString().trim() ?? "";
  const subject = formData.get("subject")?.toString().trim() ?? "";
  const body = formData.get("body")?.toString() ?? "";
  const fromRaw = formData.get("from")?.toString().trim() ?? "";

  if (!to) return { error: "Recipient is required." };
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Body is required." };

  const { ctx } = await getDashboardContext();
  try {
    const r = await sendEmail(ctx, {
      to,
      subject,
      text: body,
      ...(fromRaw ? { from: fromRaw } : {}),
    });
    revalidatePath(ROUTE);
    return { ok: true, messageId: r.messageId };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to send." };
  }
}
