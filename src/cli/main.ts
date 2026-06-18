#!/usr/bin/env node
import { Command } from "commander";
import { actionCommand } from "./commands/action.js";
import { accountCommand } from "./commands/account.js";
import { keyCommand } from "./commands/key.js";
import { schemaCommand } from "./commands/schema.js";
import { financeCommand } from "./commands/finance.js";
import { ApiClientError } from "./client.js";
import { CliConfigError } from "./config.js";
import { codeToExit, ExitCode } from "./exit-codes.js";

const program = new Command();

program
  .name("krabs")
  .description("krabs — personal finance tracker for AI agents")
  .version("0.6.0")
  .enablePositionalOptions();

program.addCommand(schemaCommand());
program.addCommand(accountCommand());
program.addCommand(keyCommand());
program.addCommand(financeCommand());
program.addCommand(actionCommand());

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    handleError(err);
  }
}

function handleError(err: unknown): never {
  const json = process.stdout.isTTY === false;

  if (err instanceof ApiClientError) {
    const errBody: { code: string; message: string; hint?: string; field?: string } = {
      code: err.code,
      message: err.message,
    };
    if (err.hint) errBody.hint = err.hint;
    if (err.field) errBody.field = err.field;
    const body = { error: errBody, _schema_version: "1" };
    if (json) {
      process.stderr.write(JSON.stringify(body) + "\n");
    } else {
      process.stderr.write(`✘ ${err.code}: ${err.message}\n`);
      if (err.hint) process.stderr.write(`  hint: ${err.hint}\n`);
      if (err.field) process.stderr.write(`  field: ${err.field}\n`);
    }
    process.exit(codeToExit(err.code));
  }

  if (err instanceof CliConfigError) {
    const body = {
      error: { code: "UNAUTHENTICATED", message: err.message },
      _schema_version: "1",
    };
    if (json) process.stderr.write(JSON.stringify(body) + "\n");
    else process.stderr.write(`✘ ${err.message}\n`);
    process.exit(ExitCode.AUTH);
  }

  const message = err instanceof Error ? err.message : String(err);
  const body = { error: { code: "INTERNAL", message }, _schema_version: "1" };
  if (json) process.stderr.write(JSON.stringify(body) + "\n");
  else process.stderr.write(`✘ ${message}\n`);
  process.exit(ExitCode.UNKNOWN);
}

main();
