import { handle } from "hono/vercel";
import { buildApp } from "../src/api/app.js";

export const config = {
  runtime: "nodejs",
};

export default handle(buildApp());
