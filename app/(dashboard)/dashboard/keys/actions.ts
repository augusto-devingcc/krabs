"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { createApiKey, revokeApiKey } from "../../../../src/domain/api-key.js";

export async function createKeyAction(
  formData: FormData,
): Promise<{ token: string; id: string; label: string } | { error: string }> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Label is required" };

  const { ctx } = await getDashboardContext();
  try {
    const result = await createApiKey(ctx, { label }, { intent: "created from web dashboard" });
    revalidatePath("/dashboard/keys");
    return { token: result.token, id: result.apiKey.id, label: result.apiKey.label };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function revokeKeyAction(keyId: string): Promise<{ ok: true } | { error: string }> {
  const { ctx } = await getDashboardContext();
  if (keyId === ctx.apiKeyId) {
    return {
      error: "You cannot revoke the Web Dashboard key — it's how this UI talks to the API.",
    };
  }
  try {
    await revokeApiKey(ctx, keyId, { intent: "revoked from web dashboard" });
    revalidatePath("/dashboard/keys");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
