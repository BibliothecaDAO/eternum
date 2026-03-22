#!/usr/bin/env tsx
/**
 * Axis CLI — Commander.js program definition.
 *
 * Entry point for all three modes:
 *   axis run       — autonomous agent loop
 *   axis mcp       — MCP server
 *   axis <command>  — one-shot tool commands
 */

import { Command } from "commander";
import { registerRunCommand } from "./commands/run.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerMapCommands } from "./commands/map.js";
import { registerToolCommands } from "./commands/tools.js";

const program = new Command();

program
  .name("axis")
  .description("Eternum onchain agent CLI")
  .version("0.2.0")
  .option("--json", "Output results as JSON");

registerRunCommand(program);
registerMcpCommand(program);
registerMapCommands(program);
registerToolCommands(program);

program.parse();
