import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
  markInvoiceSent,
  markInvoicePaid,
  voidInvoice,
} from "../../domain/invoice.js";
import { readMutationOptions } from "../../api/helpers.js";

export const invoicesRoute = new Hono();
invoicesRoute.use("*", apiKeyAuth);

invoicesRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters: {
    status?: string;
    contactId?: string;
    subscriptionId?: string;
    dealId?: string;
    from?: string;
    to?: string;
  } = {};
  const status = c.req.query("status");
  const contactId = c.req.query("contact_id");
  const subscriptionId = c.req.query("subscription_id");
  const dealId = c.req.query("deal_id");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (status) filters.status = status;
  if (contactId) filters.contactId = contactId;
  if (subscriptionId) filters.subscriptionId = subscriptionId;
  if (dealId) filters.dealId = dealId;
  if (from) filters.from = from;
  if (to) filters.to = to;
  return c.json(wrap(await listInvoices(auth, filters as Parameters<typeof listInvoices>[1])));
});

invoicesRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const result = await createInvoice(auth, raw as Parameters<typeof createInvoice>[1], opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

invoicesRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("invoice").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid invoice id", field: "id" });
  }
  return c.json(wrap({ invoice: await getInvoice(auth, id) }));
});

invoicesRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("invoice").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid invoice id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  return c.json(wrap(await updateInvoice(auth, id, raw as Parameters<typeof updateInvoice>[2], opts)));
});

invoicesRoute.post("/:id/send", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("invoice").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid invoice id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await markInvoiceSent(auth, id, opts)));
});

invoicesRoute.post("/:id/pay", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("invoice").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid invoice id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? raw : {};
  return c.json(
    wrap(await markInvoicePaid(auth, id, body as Parameters<typeof markInvoicePaid>[2], opts)),
  );
});

invoicesRoute.post("/:id/void", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("invoice").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid invoice id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await voidInvoice(auth, id, opts)));
});
