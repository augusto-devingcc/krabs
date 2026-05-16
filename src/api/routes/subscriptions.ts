import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  createSubscription,
  getSubscription,
  listSubscriptions,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
} from "../../domain/subscription.js";
import { readMutationOptions } from "../../api/helpers.js";

export const subscriptionsRoute = new Hono();
subscriptionsRoute.use("*", apiKeyAuth);

subscriptionsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters: { status?: string; contactId?: string; productId?: string } = {};
  const status = c.req.query("status");
  const contactId = c.req.query("contact_id");
  const productId = c.req.query("product_id");
  if (status) filters.status = status;
  if (contactId) filters.contactId = contactId;
  if (productId) filters.productId = productId;
  return c.json(
    wrap(await listSubscriptions(auth, filters as Parameters<typeof listSubscriptions>[1])),
  );
});

subscriptionsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const result = await createSubscription(
    auth,
    raw as Parameters<typeof createSubscription>[1],
    opts,
  );
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

subscriptionsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("subscription").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid subscription id", field: "id" });
  }
  return c.json(wrap({ subscription: await getSubscription(auth, id) }));
});

subscriptionsRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("subscription").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid subscription id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  return c.json(
    wrap(
      await updateSubscription(auth, id, raw as Parameters<typeof updateSubscription>[2], opts),
    ),
  );
});

subscriptionsRoute.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("subscription").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid subscription id", field: "id" });
  }
  const opts = readMutationOptions(c);
  // Body is optional for cancel; default to {}
  const raw = await c.req.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? raw : {};
  return c.json(
    wrap(await cancelSubscription(auth, id, body as Parameters<typeof cancelSubscription>[2], opts)),
  );
});

subscriptionsRoute.post("/:id/pause", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("subscription").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid subscription id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await pauseSubscription(auth, id, opts)));
});

subscriptionsRoute.post("/:id/resume", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("subscription").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid subscription id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await resumeSubscription(auth, id, opts)));
});
