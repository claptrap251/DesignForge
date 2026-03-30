#!/usr/bin/env node

import { Command } from "commander";
import { DFClient } from "./client";
import { pullCommand } from "./commands/pull";
import { uploadCommand } from "./commands/upload";
import { relatedCommand } from "./commands/related";

const program = new Command();

program
  .name("dfcli")
  .description("DesignForge CLI — AI agent context loading tool")
  .version("0.1.0")
  .option("--base-url <url>", "DesignForge instance URL", process.env.DFCLI_URL || "http://localhost:3000")
  .option("--token <token>", "API token", process.env.DFCLI_TOKEN)
  .option("--verbose", "Print debug info to stderr", false);

function getClient(): DFClient {
  const opts = program.opts();
  return new DFClient({
    baseUrl: opts.baseUrl,
    token: opts.token,
    verbose: opts.verbose,
  });
}

program.addCommand(pullCommand(getClient));
program.addCommand(uploadCommand(getClient));
program.addCommand(relatedCommand(getClient));

program.parse();
