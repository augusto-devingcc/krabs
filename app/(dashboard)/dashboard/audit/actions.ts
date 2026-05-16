"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { undoAction } from "../../../../src/domain/action.js";

export async function undoActionFromWeb(actionId: string): Promise<{ ok: true; newActionId: string | null } | { error: string }> {
  const { ctx } = await getDashboardContext();
  try {
    const r = await undoAction(ctx, actionId, { intent: "undone from web dashboard" });
    revalidatePath("/dashboard/audit");
    revalidatePath("/dashboard");
    return { ok: true, newActionId: r.agentActionId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
