import { Hono } from "hono";
import { wrap } from "../../contract/envelope.js";
import { describeContract } from "../../contract/operations.js";

export const schemaRoute = new Hono();

// schema.describe is intentionally PUBLIC: any agent should be able to
// discover the contract before authenticating.
schemaRoute.get("/", (c) => c.json(wrap(describeContract())));
