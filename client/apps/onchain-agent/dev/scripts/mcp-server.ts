import { startMcpServer } from "../../src/mcp/server.js";

startMcpServer().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
