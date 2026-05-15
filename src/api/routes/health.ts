import { Hono } from "hono";
import { wrap } from "@/contract/envelope.js";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => c.json(wrap({ ok: true, service: "socrm-api" })));
