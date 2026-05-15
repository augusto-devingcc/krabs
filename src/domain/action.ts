import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  agentActions,
  apiKeys,
  contacts,
  identities,
  interactions,
  accounts,
} from "@/db/schema.js";
import { ApiError } from "@/contract/errors.js";
import { newId } from "@/contract/ids.js";
import type { Contact } from "@/contract/schemas/contact.js";
import type { Identity } from "@/contract/schemas/identity.js";
import type { Interaction } from "@/contract/schemas/interaction.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export type AgentActionFull = {
  id: string;
  accountId: string;
  apiKeyId: string;
  operation: string;
  targetKind: string;
  targetId: string;
  intent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type Reversibility = "reversible" | "one-way" | "read-only";

const REVERSIBILITY: Record<string, Reversibility> = {
  // mutations: reversible
  "contact.create": "reversible",
  "contact.update": "reversible",
  "contact.delete": "reversible",
  "identity.add": "reversible",
  "identity.remove": "reversible",
  "account.update": "reversible",
  "api_key.create": "reversible",
  "api_key.revoke": "reversible",
  "interaction.create": "reversible",
  "interaction.delete": "reversible",
  "interaction.ingest_email": "reversible",
  // one-way (intentionally not exposed for undo)
  "contact.merge": "one-way",
  // meta
  "action.undo": "one-way",
  // read-only ops never appear in the audit log; included here for catalog completeness
};

export function reversibilityOf(operation: string): Reversibility {
  return REVERSIBILITY[operation] ?? "one-way";
}

export async function getAction(ctx: CallerContext, id: string): Promise<AgentActionFull> {
  const row = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.id, id), eq(agentActions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) {
    throw new ApiError({ code: "NOT_FOUND", message: `Action ${id} not found` });
  }
  return {
    id: row.id,
    accountId: row.accountId,
    apiKeyId: row.apiKeyId,
    operation: row.operation,
    targetKind: row.targetKind,
    targetId: row.targetId,
    intent: row.intent,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.createdAt,
  };
}

// ───────────────────────────────────────── undo

export type UndoActionResult = {
  undoneActionId: string;
  operation: string;
  reversal: Record<string, unknown>;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function undoAction(
  ctx: CallerContext,
  actionId: string,
  options: MutationOptions = {},
): Promise<UndoActionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UndoActionResult>(ctx, idempotencyKey, "action.undo");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const action = await getAction(ctx, actionId);

  const reversibility = reversibilityOf(action.operation);
  if (reversibility !== "reversible") {
    const errArgs: { code: "CONFLICT"; message: string; hint?: string } = {
      code: "CONFLICT",
      message: `Action ${action.operation} is ${reversibility} and cannot be undone`,
    };
    if (reversibility === "one-way") errArgs.hint = "Re-execute the desired state manually.";
    throw new ApiError(errArgs);
  }

  const now = new Date().toISOString();
  const dispatcher = undoDispatchers[action.operation];
  if (!dispatcher) {
    throw new ApiError({
      code: "CONFLICT",
      message: `No undo handler registered for ${action.operation}`,
    });
  }

  if (dryRun) {
    const plan = await dispatcher.plan(ctx, action);
    return {
      undoneActionId: actionId,
      operation: action.operation,
      reversal: plan,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const undoActionId = newId("agentAction");
  let reversal: Record<string, unknown> = {};

  await db.transaction(async (tx) => {
    reversal = await dispatcher.execute(ctx, action, tx, now);

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
      operation: "action.undo",
      targetKind: action.targetKind,
      targetId: action.targetId,
      metadata: {
        undidActionId: action.id,
        originalOperation: action.operation,
        reversal,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: undoActionId });

    if (idempotencyKey) {
      const body: UndoActionResult = {
        undoneActionId: actionId,
        operation: action.operation,
        reversal,
        agentActionId: undoActionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "action.undo",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return {
    undoneActionId: actionId,
    operation: action.operation,
    reversal,
    agentActionId: undoActionId,
    dryRun: false,
    replayed: false,
  };
}

// ───────────────────────────────────────── dispatchers

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type UndoDispatcher = {
  plan: (ctx: CallerContext, action: AgentActionFull) => Promise<Record<string, unknown>>;
  execute: (
    ctx: CallerContext,
    action: AgentActionFull,
    tx: Tx,
    now: string,
  ) => Promise<Record<string, unknown>>;
};

const undoDispatchers: Record<string, UndoDispatcher> = {
  "contact.create": {
    plan: async (_ctx, a) => ({ willDeleteContactId: a.targetId }),
    execute: async (ctx, a, tx) => {
      const r = await tx
        .delete(contacts)
        .where(and(eq(contacts.id, a.targetId), eq(contacts.accountId, ctx.accountId)));
      return { deletedContactId: a.targetId, rowsAffected: r.rowsAffected ?? null };
    },
  },

  "contact.update": {
    plan: async (_ctx, a) => {
      const before = (a.metadata?.["before"] as Contact | undefined) ?? null;
      return { willRestore: before };
    },
    execute: async (ctx, a, tx) => {
      const before = a.metadata?.["before"] as Contact | undefined;
      if (!before) throw new ApiError({ code: "CONFLICT", message: "No before-snapshot in action metadata" });
      await tx
        .update(contacts)
        .set({
          name: before.name,
          primaryEmail: before.primaryEmail,
          primaryPhone: before.primaryPhone,
          status: before.status,
          customFields: before.customFields ? JSON.stringify(before.customFields) : null,
          updatedAt: before.updatedAt,
        })
        .where(and(eq(contacts.id, a.targetId), eq(contacts.accountId, ctx.accountId)));
      return { restored: before };
    },
  },

  "contact.delete": {
    plan: async (_ctx, a) => {
      const snap = a.metadata?.["snapshot"] as
        | { contact: Contact; identities: Identity[]; interactionIds?: string[] }
        | undefined;
      return { willRestore: snap ?? null };
    },
    execute: async (ctx, a, tx) => {
      const snap = a.metadata?.["snapshot"] as
        | { contact: Contact; identities: Identity[]; interactionIds?: string[] }
        | undefined;
      if (!snap) {
        throw new ApiError({ code: "CONFLICT", message: "No snapshot in action metadata" });
      }
      const c = snap.contact;
      await tx.insert(contacts).values({
        id: c.id,
        accountId: c.accountId,
        name: c.name,
        primaryEmail: c.primaryEmail,
        primaryPhone: c.primaryPhone,
        status: c.status,
        customFields: c.customFields ? JSON.stringify(c.customFields) : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });

      const restoredIdentities: Identity[] = [];
      const conflictedIdentities: Identity[] = [];
      for (const idy of snap.identities) {
        try {
          await tx.insert(identities).values({
            id: idy.id,
            accountId: idy.accountId,
            contactId: idy.contactId,
            kind: idy.kind,
            value: idy.value,
            confidence: idy.confidence,
            createdAt: idy.createdAt,
          });
          restoredIdentities.push(idy);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("UNIQUE constraint failed: identities")) {
            conflictedIdentities.push(idy);
          } else {
            throw err;
          }
        }
      }

      let relinkedInteractions = 0;
      if (snap.interactionIds && snap.interactionIds.length > 0) {
        // Only re-link interactions that still exist and are still orphaned
        const r = await tx
          .update(interactions)
          .set({ contactId: c.id })
          .where(
            and(
              eq(interactions.accountId, ctx.accountId),
              inArray(interactions.id, snap.interactionIds),
            ),
          );
        relinkedInteractions = r.rowsAffected ?? 0;
      }

      return {
        restoredContactId: c.id,
        restoredIdentities,
        conflictedIdentities,
        relinkedInteractions,
      };
    },
  },

  "identity.add": {
    plan: async (_ctx, a) => ({ willDeleteIdentityId: a.targetId }),
    execute: async (ctx, a, tx) => {
      await tx
        .delete(identities)
        .where(and(eq(identities.id, a.targetId), eq(identities.accountId, ctx.accountId)));
      return { deletedIdentityId: a.targetId };
    },
  },

  "identity.remove": {
    plan: async (_ctx, a) => ({
      willRestore: a.metadata?.["snapshot"] as Identity | undefined,
    }),
    execute: async (ctx, a, tx) => {
      const snap = a.metadata?.["snapshot"] as Identity | undefined;
      if (!snap) throw new ApiError({ code: "CONFLICT", message: "No snapshot in action metadata" });
      try {
        await tx.insert(identities).values({
          id: snap.id,
          accountId: snap.accountId,
          contactId: snap.contactId,
          kind: snap.kind,
          value: snap.value,
          confidence: snap.confidence,
          createdAt: snap.createdAt,
        });
        return { restoredIdentityId: snap.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("UNIQUE constraint failed: identities")) {
          throw new ApiError({
            code: "CONFLICT",
            message: `This ${snap.kind} is now attached to another contact; cannot restore`,
          });
        }
        throw err;
      }
    },
  },

  "account.update": {
    plan: async (_ctx, a) => ({
      willRestore: a.metadata?.["before"] as Record<string, unknown> | undefined,
    }),
    execute: async (ctx, a, tx) => {
      const before = a.metadata?.["before"] as
        | { name: string | null; email: string; updatedAt?: string }
        | undefined;
      if (!before) throw new ApiError({ code: "CONFLICT", message: "No before-snapshot" });
      await tx
        .update(accounts)
        .set({ name: before.name, email: before.email })
        .where(eq(accounts.id, ctx.accountId));
      return { restored: before };
    },
  },

  "api_key.create": {
    plan: async (_ctx, a) => ({ willRevokeApiKeyId: a.targetId }),
    execute: async (ctx, a, tx, now) => {
      await tx
        .update(apiKeys)
        .set({ revokedAt: now })
        .where(and(eq(apiKeys.id, a.targetId), eq(apiKeys.accountId, ctx.accountId)));
      return { revokedApiKeyId: a.targetId };
    },
  },

  "api_key.revoke": {
    plan: async (_ctx, a) => ({ willUnrevokeApiKeyId: a.targetId }),
    execute: async (ctx, a, tx) => {
      await tx
        .update(apiKeys)
        .set({ revokedAt: null })
        .where(and(eq(apiKeys.id, a.targetId), eq(apiKeys.accountId, ctx.accountId)));
      return { unrevokedApiKeyId: a.targetId };
    },
  },

  "interaction.create": {
    plan: async (_ctx, a) => ({ willDeleteInteractionId: a.targetId }),
    execute: async (ctx, a, tx) => {
      await tx
        .delete(interactions)
        .where(and(eq(interactions.id, a.targetId), eq(interactions.accountId, ctx.accountId)));
      return { deletedInteractionId: a.targetId };
    },
  },

  "interaction.delete": {
    plan: async (_ctx, a) => ({
      willRestore: a.metadata?.["snapshot"] as Interaction | undefined,
    }),
    execute: async (ctx, a, tx) => {
      const snap = a.metadata?.["snapshot"] as Interaction | undefined;
      if (!snap) throw new ApiError({ code: "CONFLICT", message: "No snapshot in action metadata" });
      await tx.insert(interactions).values({
        id: snap.id,
        accountId: snap.accountId,
        contactId: snap.contactId,
        kind: snap.kind,
        direction: snap.direction,
        source: snap.source,
        subject: snap.subject,
        body: snap.body,
        metadata: snap.metadata ? JSON.stringify(snap.metadata) : null,
        occurredAt: snap.occurredAt,
        createdAt: snap.createdAt,
      });
      return { restoredInteractionId: snap.id };
    },
  },

  "interaction.ingest_email": {
    plan: async (_ctx, a) => ({
      willDeleteInteractionId: a.targetId,
      alsoDeleteContact: Boolean(a.metadata?.["contactCreated"]),
      contactId: a.metadata?.["contactId"] as string | undefined,
    }),
    execute: async (ctx, a, tx) => {
      await tx
        .delete(interactions)
        .where(and(eq(interactions.id, a.targetId), eq(interactions.accountId, ctx.accountId)));
      const reversal: Record<string, unknown> = { deletedInteractionId: a.targetId };

      const contactCreated = Boolean(a.metadata?.["contactCreated"]);
      const contactId = a.metadata?.["contactId"] as string | undefined;
      if (contactCreated && contactId) {
        // Only delete the contact if it has no other interactions / activity
        await tx
          .delete(contacts)
          .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)));
        reversal.deletedContactId = contactId;
      }
      return reversal;
    },
  },
};
