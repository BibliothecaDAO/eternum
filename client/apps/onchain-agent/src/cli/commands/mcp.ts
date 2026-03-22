import type { Command } from "commander";

export function registerMcpCommand(program: Command) {
  program
    .command("mcp")
    .description("Start the MCP server (stdio transport for Claude Code)")
    .action(async () => {
      const { startMcpServer } = await import("../../mcp/server.js");
      await startMcpServer();
    });
}
