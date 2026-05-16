import type { BillingCycle } from "../db/schema.js";

/**
 * Normalize any billing cycle to monthly cents — the unit we use for MRR
 * aggregation. Stored denormalized on each subscription row so that
 * `SUM(mrr_cents) WHERE status IN ('active','trialing')` returns MRR in one
 * indexed scan.
 *
 * Quarterly = 3 monthly payments. Yearly = 12. Custom uses 30.44 days/month
 * as the conversion (Gregorian average).
 */
export function computeMrrCents(
  amountCents: number,
  billingCycle: BillingCycle,
  customCycleDays?: number | null,
): number {
  switch (billingCycle) {
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "yearly":
      return Math.round(amountCents / 12);
    case "custom_days": {
      if (!customCycleDays || customCycleDays <= 0) {
        throw new Error("custom_cycle_days is required when billing_cycle is custom_days");
      }
      // Convert custom cycle to monthly: (amount / days) * 30.44.
      const dailyCents = amountCents / customCycleDays;
      return Math.round(dailyCents * 30.44);
    }
  }
}

/**
 * Given a period start and a billing cycle, return the ISO date of the
 * NEXT period end. Used when creating or rolling subscriptions.
 */
export function computePeriodEnd(
  startIso: string,
  billingCycle: BillingCycle,
  customCycleDays?: number | null,
): string {
  const start = new Date(startIso);
  const end = new Date(start);
  switch (billingCycle) {
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    case "quarterly":
      end.setMonth(end.getMonth() + 3);
      break;
    case "yearly":
      end.setFullYear(end.getFullYear() + 1);
      break;
    case "custom_days": {
      if (!customCycleDays || customCycleDays <= 0) {
        throw new Error("custom_cycle_days is required when billing_cycle is custom_days");
      }
      end.setDate(end.getDate() + customCycleDays);
      break;
    }
  }
  return end.toISOString();
}

/**
 * Format a cents amount as a major-unit string (e.g. 12900 → "129.00").
 * Currency-agnostic — assumes the caller knows the currency. For
 * presentation only; comparison/arithmetic stays in cents.
 */
export function formatCents(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Generate a human-readable invoice number scoped to the year:
 *   INV-2026-0001, INV-2026-0002, …
 * The caller is responsible for passing the correct `nextSeq` (typically
 * a per-account counter looked up at insert time).
 */
export function formatInvoiceNumber(year: number, nextSeq: number): string {
  return `INV-${year}-${nextSeq.toString().padStart(4, "0")}`;
}
