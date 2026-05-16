"use server";

export async function requestUpgradeAction(
  plan: "solo" | "pro",
): Promise<{ ok: false; message: string }> {
  // Stub — Polar checkout integration coming soon.
  void plan;
  return {
    ok: false,
    message: "Polar checkout coming soon — email support@socrm.dev to upgrade today.",
  };
}
