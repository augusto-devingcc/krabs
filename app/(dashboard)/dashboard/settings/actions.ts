"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { updateAccount } from "../../../../src/domain/account.js";

export async function updateAccountAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const { ctx } = await getDashboardContext();
  try {
    await updateAccount(
      ctx,
      { name: name.length === 0 ? null : name },
      { intent: "renamed from web dashboard" },
    );
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
