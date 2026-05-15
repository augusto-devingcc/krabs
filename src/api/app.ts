import { Hono } from "hono";
import { healthRoute } from "./routes/health.js";
import { meRoute } from "./routes/me.js";
import { contactsRoute, actionsRoute } from "./routes/contacts.js";
import { errorHandler } from "./middleware/error.js";

export function buildApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.route("/v1/health", healthRoute);
  app.route("/v1/me", meRoute);
  app.route("/v1/contacts", contactsRoute);
  app.route("/v1/actions", actionsRoute);

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
