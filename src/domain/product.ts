import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  agentActions,
  products,
  billingCycles,
  pricingModels,
  productKinds,
  productStatuses,
  type ProductRow,
  type ProductStatus,
  type ProductKind,
  type PricingModel,
  type BillingCycle,
} from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { ApiError } from "../contract/errors.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const productCreateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kind: z.enum(productKinds).default("saas"),
    pricingModel: z.enum(pricingModels).default("recurring"),
    unitAmountCents: z.number().int().min(0),
    currency: z.string().length(3).default("USD"),
    billingCycle: z.enum(billingCycles).nullable().optional(),
    customCycleDays: z.number().int().positive().nullable().optional(),
    customFields: z.record(z.unknown()).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.pricingModel === "recurring" && !val.billingCycle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billingCycle"],
        message: "billingCycle is required when pricingModel is recurring",
      });
    }
    if (val.billingCycle === "custom_days" && !val.customCycleDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customCycleDays"],
        message: "customCycleDays is required when billingCycle is custom_days",
      });
    }
  });

export const productUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(productKinds).optional(),
  pricingModel: z.enum(pricingModels).optional(),
  unitAmountCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  billingCycle: z.enum(billingCycles).nullable().optional(),
  customCycleDays: z.number().int().positive().nullable().optional(),
  status: z.enum(productStatuses).optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export const productListFiltersSchema = z.object({
  status: z.enum(productStatuses).optional(),
  kind: z.enum(productKinds).optional(),
});

export type ProductCreateInput = z.input<typeof productCreateInputSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateInputSchema>;
export type ProductListFilters = z.infer<typeof productListFiltersSchema>;

export type Product = {
  id: string;
  accountId: string;
  name: string;
  kind: ProductKind;
  pricingModel: PricingModel;
  unitAmountCents: number;
  currency: string;
  billingCycle: BillingCycle | null;
  customCycleDays: number | null;
  status: ProductStatus;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    kind: row.kind as ProductKind,
    pricingModel: row.pricingModel as PricingModel,
    unitAmountCents: row.unitAmountCents,
    currency: row.currency,
    billingCycle: (row.billingCycle as BillingCycle | null) ?? null,
    customCycleDays: row.customCycleDays,
    status: row.status as ProductStatus,
    customFields: row.customFields
      ? (JSON.parse(row.customFields) as Record<string, unknown>)
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type CreateProductResult = {
  product: Product;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createProduct(
  ctx: CallerContext,
  input: z.input<typeof productCreateInputSchema>,
  options: MutationOptions = {},
): Promise<CreateProductResult> {
  const parsed = productCreateInputSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateProductResult>(ctx, idempotencyKey, "product.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const now = new Date().toISOString();
  const id = newId("product");
  const planned: Product = {
    id,
    accountId: ctx.accountId,
    name: parsed.name,
    kind: parsed.kind,
    pricingModel: parsed.pricingModel,
    unitAmountCents: parsed.unitAmountCents,
    currency: parsed.currency,
    billingCycle: parsed.billingCycle ?? null,
    customCycleDays: parsed.customCycleDays ?? null,
    status: "active",
    customFields: parsed.customFields ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) return { product: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id: planned.id,
      accountId: planned.accountId,
      name: planned.name,
      kind: planned.kind,
      pricingModel: planned.pricingModel,
      unitAmountCents: planned.unitAmountCents,
      currency: planned.currency,
      billingCycle: planned.billingCycle,
      customCycleDays: planned.customCycleDays,
      status: planned.status,
      customFields: planned.customFields ? JSON.stringify(planned.customFields) : null,
      createdAt: planned.createdAt,
      updatedAt: planned.updatedAt,
    });
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
      operation: "product.create",
      targetKind: "product",
      targetId: id,
      metadata: { name: planned.name, kind: planned.kind, pricingModel: planned.pricingModel },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CreateProductResult = { product: planned, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "product.create", responseStatus: 201, responseBody: body }),
      );
    }
  });
  return { product: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getProduct(ctx: CallerContext, id: string): Promise<Product> {
  const row = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Product ${id} not found` });
  return rowToProduct(row);
}

export type ListProductsResult = { items: Product[] };

export async function listProducts(
  ctx: CallerContext,
  filters: ProductListFilters = {},
): Promise<ListProductsResult> {
  const conds = [eq(products.accountId, ctx.accountId)];
  if (filters.status) conds.push(eq(products.status, filters.status));
  if (filters.kind) conds.push(eq(products.kind, filters.kind));
  const rows = await db
    .select()
    .from(products)
    .where(and(...conds))
    .orderBy(desc(products.createdAt), asc(products.id));
  return { items: rows.map(rowToProduct) };
}

export type UpdateProductResult = {
  product: Product;
  before: Product;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateProduct(
  ctx: CallerContext,
  id: string,
  patch: ProductUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateProductResult> {
  const parsed = productUpdateInputSchema.parse(patch);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateProductResult>(ctx, idempotencyKey, "product.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Product ${id} not found` });
  const before = rowToProduct(existing);
  const now = new Date().toISOString();

  const next: Product = {
    ...before,
    name: parsed.name ?? before.name,
    kind: parsed.kind ?? before.kind,
    pricingModel: parsed.pricingModel ?? before.pricingModel,
    unitAmountCents: parsed.unitAmountCents ?? before.unitAmountCents,
    currency: parsed.currency ?? before.currency,
    billingCycle: parsed.billingCycle === undefined ? before.billingCycle : parsed.billingCycle,
    customCycleDays:
      parsed.customCycleDays === undefined ? before.customCycleDays : parsed.customCycleDays,
    status: parsed.status ?? before.status,
    customFields: parsed.customFields === undefined ? before.customFields : parsed.customFields,
    updatedAt: now,
  };

  // Re-enforce cross-field invariants post-merge.
  if (next.pricingModel === "recurring" && !next.billingCycle) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "billingCycle is required when pricingModel is recurring",
      field: "billingCycle",
    });
  }
  if (next.billingCycle === "custom_days" && !next.customCycleDays) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "customCycleDays is required when billingCycle is custom_days",
      field: "customCycleDays",
    });
  }

  if (dryRun) return { product: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        name: next.name,
        kind: next.kind,
        pricingModel: next.pricingModel,
        unitAmountCents: next.unitAmountCents,
        currency: next.currency,
        billingCycle: next.billingCycle,
        customCycleDays: next.customCycleDays,
        status: next.status,
        customFields: next.customFields ? JSON.stringify(next.customFields) : null,
        updatedAt: now,
      })
      .where(eq(products.id, id));
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
      operation: "product.update",
      targetKind: "product",
      targetId: id,
      metadata: { before, patch: parsed },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: UpdateProductResult = { product: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "product.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { product: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type ArchiveProductResult = {
  product: Product;
  before: Product;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function archiveProduct(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<ArchiveProductResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<ArchiveProductResult>(ctx, idempotencyKey, "product.archive");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Product ${id} not found` });
  const before = rowToProduct(existing);
  const now = new Date().toISOString();
  const next: Product = { ...before, status: "archived", updatedAt: now };

  if (dryRun) return { product: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: "archived", updatedAt: now })
      .where(eq(products.id, id));
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
      operation: "product.archive",
      targetKind: "product",
      targetId: id,
      metadata: { before },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: ArchiveProductResult = { product: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "product.archive", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { product: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}
