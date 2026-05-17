import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { accounts, agentActions } from "../db/schema.js";
import { ApiError } from "../contract/errors.js";
import { newId } from "../contract/ids.js";
import {
  buildAction,
  buildIdempotencyRecord,
  idempotencyKeys,
  lookupIdempotent,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const revenueModels = [
  "recurring_saas",
  "one_time",
  "hybrid",
  "freelance",
  "marketplace",
  "other",
] as const;
export type RevenueModel = (typeof revenueModels)[number];

export const billingCadences = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "per_project",
  "mixed",
] as const;
export type BillingCadence = (typeof billingCadences)[number];

export const adChannels = [
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "linkedin_ads",
  "x_ads",
  "youtube_ads",
  "organic",
  "referral",
  "outbound",
  "events",
  "other",
] as const;
export type AdChannel = (typeof adChannels)[number];

export const businessProfileSchema = z.object({
  revenueModel: z.enum(revenueModels),
  cadence: z.enum(billingCadences).optional(),
  typicalContractCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("USD"),
  activeChannels: z.array(z.enum(adChannels)).default([]),
  notes: z.string().trim().max(2000).optional(),
  // Free-form extension — agents can stash arbitrary structured context here.
  custom: z.record(z.unknown()).optional(),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export type BusinessProfileResult = {
  profile: BusinessProfile | null;
  setAt: string | null;
};

export async function getBusinessProfile(
  ctx: CallerContext,
): Promise<BusinessProfileResult> {
  const row = await db
    .select({ raw: accounts.businessProfile, updatedAt: accounts.updatedAt })
    .from(accounts)
    .where(eq(accounts.id, ctx.accountId))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: "Account not found" });
  if (!row.raw) return { profile: null, setAt: null };
  const parsed = businessProfileSchema.safeParse(JSON.parse(row.raw));
  if (!parsed.success) {
    // Corrupt or pre-schema profile — return null instead of throwing so agents
    // can re-run the kickoff cleanly.
    return { profile: null, setAt: row.updatedAt };
  }
  return { profile: parsed.data, setAt: row.updatedAt };
}

export type SetBusinessProfileResult = {
  profile: BusinessProfile;
  before: BusinessProfile | null;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function setBusinessProfile(
  ctx: CallerContext,
  input: z.input<typeof businessProfileSchema>,
  options: MutationOptions = {},
): Promise<SetBusinessProfileResult> {
  const parsed = businessProfileSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<SetBusinessProfileResult>(
      ctx,
      idempotencyKey,
      "businessProfile.set",
    );
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const beforeRes = await getBusinessProfile(ctx);
  const before = beforeRes.profile;

  if (dryRun) {
    return { profile: parsed, before, agentActionId: null, dryRun: true, replayed: false };
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ businessProfile: JSON.stringify(parsed), updatedAt: now })
      .where(eq(accounts.id, ctx.accountId));
    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "businessProfile.set",
      targetKind: "account",
      targetId: ctx.accountId,
      metadata: { before, after: parsed },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: SetBusinessProfileResult = {
        profile: parsed,
        before,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "businessProfile.set",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return { profile: parsed, before, agentActionId: actionId, dryRun: false, replayed: false };
}
