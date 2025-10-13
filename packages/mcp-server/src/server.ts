import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { createServerContext } from "./context.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";
import { logger } from "./utils/logger.js";

export async function startServer(): Promise<McpServer> {
  const config = loadConfig();
  const context = await createServerContext(config);

  const server = new McpServer({
    name: "eternum-mcp-server",
    version: "0.1.0",
  });

  registerResources(server, context);
  registerTools(server, context);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server connected to stdio transport");

  return server;
}

async function main() {
  try {
    await startServer();
  } catch (error) {
    logger.error({ error }, "Failed to start MCP server");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
