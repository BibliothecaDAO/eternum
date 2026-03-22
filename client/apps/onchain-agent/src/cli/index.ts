#!/usr/bin/env tsx
// Suppress noisy provider logs (fee estimation failures, tx data warnings)
{
  const _warn = console.warn;
  const _error = console.error;
  const _info = console.info;
  const providerNoise = (msg: string) =>
    msg.includes("[provider]") ||
    msg.includes("Failed to estimate invoke fee") ||
    msg.includes("Insufficient transaction data") ||
    msg.includes("[DEPRECATED]");
  console.warn = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) _warn.apply(console, a);
  };
  console.error = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) _error.apply(console, a);
  };
  console.info = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) _info.apply(console, a);
  };
}
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
import { registerAuthCommand } from "./commands/auth.js";
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
registerAuthCommand(program);
registerMapCommands(program);
registerToolCommands(program);

program.parse();
