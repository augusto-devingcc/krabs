import { Hono } from "hono";
import { healthRoute } from "./routes/health.js";
import { meRoute } from "./routes/me.js";
import { contactsRoute, actionsRoute } from "./routes/contacts.js";
import { accountRoute } from "./routes/account.js";
import { apiKeysRoute } from "./routes/api-keys.js";
import { schemaRoute } from "./routes/schema.js";
import { identitiesRoute, contactFindRoute } from "./routes/identities.js";
import { interactionsRoute } from "./routes/interactions.js";
import { errorHandler } from "./middleware/error.js";

export function buildApp() {
  const app = new Hono();

  app.onError(errorHandler);

  app.route("/v1/health", healthRoute);
  app.route("/v1/schema", schemaRoute);
  app.route("/v1/me", meRoute);
  app.route("/v1/account", accountRoute);
  app.route("/v1/api-keys", apiKeysRoute);
  // Mount /v1/contacts/find BEFORE the parameterized contact routes
  app.route("/v1/contacts/find", contactFindRoute);
  app.route("/v1/contacts", contactsRoute);
  app.route("/v1/identities", identitiesRoute);
  app.route("/v1/interactions", interactionsRoute);
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
