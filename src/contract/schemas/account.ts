import { z } from "zod";
import { idSchema } from "../ids.js";

export const accountSchema = z.object({
  id: idSchema("account"),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Account = z.infer<typeof accountSchema>;
