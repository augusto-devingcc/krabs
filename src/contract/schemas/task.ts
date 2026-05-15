import { z } from "zod";
import { idSchema } from "../ids.js";
import { taskStatuses, taskPriorities } from "@/db/schema.js";

export const taskStatusSchema = z.enum(taskStatuses);
export const taskPrioritySchema = z.enum(taskPriorities);

export const taskSchema = z.object({
  id: idSchema("task"),
  accountId: idSchema("account"),
  contactId: idSchema("contact").nullable(),
  dealId: idSchema("deal").nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const taskCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10_000).optional(),
  contactId: idSchema("contact").optional(),
  dealId: idSchema("deal").optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().optional(),
});

export const taskUpdateInputSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).nullable().optional(),
  contactId: idSchema("contact").nullable().optional(),
  dealId: idSchema("deal").nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export const taskListFiltersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  contactId: idSchema("contact").optional(),
  dealId: idSchema("deal").optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueBefore: z.string().datetime().optional(),
});

export type Task = z.infer<typeof taskSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;
export type TaskListFilters = z.infer<typeof taskListFiltersSchema>;
