import { Hono } from "hono";
import { healthRoute } from "./routes/health.js";
import { meRoute } from "./routes/me.js";
import { accountRoute } from "./routes/account.js";
import { apiKeysRoute } from "./routes/api-keys.js";
import { schemaRoute } from "./routes/schema.js";
import { actionsRoute } from "./routes/actions.js";
import { productsRoute } from "./routes/products.js";
import { subscriptionsRoute } from "./routes/subscriptions.js";
import { invoicesRoute } from "./routes/invoices.js";
import { expensesRoute } from "./routes/expenses.js";
import { financeRoute } from "./routes/finance.js";
import { mcpRoute } from "./routes/mcp.js";
import { errorHandler } from "./middleware/error.js";

export function buildApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.route("/v1/health", healthRoute);
  app.route("/v1/schema", schemaRoute);
  app.route("/v1/me", meRoute);
  app.route("/v1/account", accountRoute);
  app.route("/v1/api-keys", apiKeysRoute);
  app.route("/v1/products", productsRoute);
  app.route("/v1/subscriptions", subscriptionsRoute);
  app.route("/v1/invoices", invoicesRoute);
  app.route("/v1/expenses", expensesRoute);
  app.route("/v1/finance", financeRoute);
  app.route("/v1/actions", actionsRoute);
  app.route("/v1/mcp", mcpRoute);

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Route ${c.req.method} ${c.req.path} not found`,
        },
        _schema_version: "1",
      },
      404,
    ),
  );

  return app;
}
