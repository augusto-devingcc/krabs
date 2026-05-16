"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "../../../../../../src/lib/web/dashboard-ctx.js";
import {
  connectStripe,
  disconnectStripe,
} from "../../../../../../src/integrations/stripe/connect.js";
import { ApiError } from "../../../../../../src/contract/errors.js";

const ROUTE = "/dashboard/settings/integrations/stripe";

export async function connectStripeAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const secretKey = formData.get("secretKey")?.toString().trim() ?? "";
  const displayNameRaw = formData.get("displayName")?.toString().trim() ?? "";
  const displayName = displayNameRaw || "Stripe";

  if (!secretKey) return { error: "Restricted API key is required." };
  if (!secretKey.startsWith("sk_") && !secretKey.startsWith("rk_")) {
    return { error: "Key must start with sk_ or rk_." };
  }

  const { ctx } = await getDashboardContext();
  try {
    await connectStripe(ctx, { secretKey, displayName });
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Failed to connect." };
  }
}

export async function disconnectStripeAction(): Promise<
  { ok: true } | { error: string }
> {
  const { ctx } = await getDashboardContext();
  try {
    await disconnectStripe(ctx);
    revalidatePath(ROUTE);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return {
      error: err instanceof Error ? err.message : "Failed to disconnect.",
    };
  }
}
