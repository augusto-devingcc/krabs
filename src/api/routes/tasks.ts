import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  taskCreateInputSchema,
  taskUpdateInputSchema,
  taskListFiltersSchema,
} from "../../contract/schemas/task.js";
import { createTask, getTask, listTasks, updateTask, deleteTask } from "../../domain/task.js";
import { readMutationOptions, parseOrThrow } from "../../api/helpers.js";

export const tasksRoute = new Hono();
tasksRoute.use("*", apiKeyAuth);

tasksRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters = parseOrThrow(taskListFiltersSchema, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    contactId: c.req.query("contact_id"),
    dealId: c.req.query("deal_id"),
    status: c.req.query("status"),
    priority: c.req.query("priority"),
    dueBefore: c.req.query("due_before"),
  });
  return c.json(wrap(await listTasks(auth, filters)));
});

tasksRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(taskCreateInputSchema, raw);
  const result = await createTask(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

tasksRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("task").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid task id", field: "id" });
  }
  return c.json(wrap({ task: await getTask(auth, id) }));
});

tasksRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("task").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid task id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const patch = parseOrThrow(taskUpdateInputSchema, raw);
  return c.json(wrap(await updateTask(auth, id, patch, opts)));
});

tasksRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("task").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid task id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await deleteTask(auth, id, opts)));
});
