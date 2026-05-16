import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
  archiveProduct,
} from "../../domain/product.js";
import { readMutationOptions } from "../../api/helpers.js";

export const productsRoute = new Hono();
productsRoute.use("*", apiKeyAuth);

productsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters: { status?: string; kind?: string } = {};
  const status = c.req.query("status");
  const kind = c.req.query("kind");
  if (status) filters.status = status;
  if (kind) filters.kind = kind;
  return c.json(wrap(await listProducts(auth, filters as Parameters<typeof listProducts>[1])));
});

productsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const result = await createProduct(auth, raw as Parameters<typeof createProduct>[1], opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

productsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("product").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid product id", field: "id" });
  }
  return c.json(wrap({ product: await getProduct(auth, id) }));
});

productsRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("product").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid product id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  return c.json(wrap(await updateProduct(auth, id, raw as Parameters<typeof updateProduct>[2], opts)));
});

productsRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("product").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid product id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await archiveProduct(auth, id, opts)));
});
