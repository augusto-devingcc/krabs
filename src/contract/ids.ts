import { ulid } from "ulid";
import { z } from "zod";

const PREFIX_SEP = "_";

const prefixes = {
  account: "acc",
  apiKey: "key",
  contact: "cnt",
  identity: "idy",
  agentAction: "act",
  idempotencyKey: "idem",
  interaction: "int",
  deal: "dl",
  task: "tsk",
  note: "not",
  tag: "tag",
  deviceAuth: "dev",
} as const;

export type EntityKind = keyof typeof prefixes;

export function newId(kind: EntityKind): string {
  return `${prefixes[kind]}${PREFIX_SEP}${ulid()}`;
}

export function idSchema(kind: EntityKind) {
  const prefix = prefixes[kind];
  return z
    .string()
    .regex(new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`), {
      message: `Expected ${kind} id (${prefix}_...)`,
    });
}
