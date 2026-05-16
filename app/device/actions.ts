"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/web/dashboard-ctx.js";
import {
  findByUserCode,
  isExpired,
  markApproved,
  markDenied,
  normalizeUserCode,
} from "@/domain/device-auth.js";

export type DeviceActionResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "expired" | "denied" | "approved" | "invalid" };

export async function submitCodeAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("userCode") ?? "").trim();
  if (!raw) redirect("/device");
  const normalized = normalizeUserCode(raw);
  redirect(`/device?code=${encodeURIComponent(normalized)}`);
}

export async function approveDeviceAction(
  formData: FormData,
): Promise<DeviceActionResult> {
  const userCode = String(formData.get("userCode") ?? "");
  if (!userCode) return { ok: false, error: "invalid" };

  const row = await findByUserCode(userCode);
  if (!row) return { ok: false, error: "not_found" };

  if (row.status === "approved") return { ok: false, error: "approved" };
  if (row.status === "denied") return { ok: false, error: "denied" };
  if (row.status === "expired" || isExpired(row)) {
    return { ok: false, error: "expired" };
  }
  if (row.status !== "pending") return { ok: false, error: "invalid" };

  const { ctx } = await getDashboardContext();
  await markApproved({ deviceAuthorizationId: row.id, accountId: ctx.accountId });
  revalidatePath("/device");
  return { ok: true };
}

export async function denyDeviceAction(
  formData: FormData,
): Promise<DeviceActionResult> {
  const userCode = String(formData.get("userCode") ?? "");
  if (!userCode) return { ok: false, error: "invalid" };

  const row = await findByUserCode(userCode);
  if (!row) return { ok: false, error: "not_found" };

  if (row.status === "approved") return { ok: false, error: "approved" };
  if (row.status === "denied") return { ok: false, error: "denied" };
  if (row.status === "expired" || isExpired(row)) {
    return { ok: false, error: "expired" };
  }

  await markDenied(row.id);
  revalidatePath("/device");
  return { ok: true };
}
