import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const MCP_URL = "https://asktorii.com/mcp";

export interface McpConnection {
  tools: AgentTool<any>[];
  close: () => Promise<void>;
}

/**
 * Connect to the eternum-explorer MCP server and return AgentTool wrappers.
 *
 * @param toriiUrl — The Torii URL the agent is connected to (with /sql suffix).
 *   Automatically injected into query-world calls so the LLM doesn't need to provide it.
 *   Returns empty tools array if connection fails (non-fatal).
 */
export async function createMcpTools(toriiUrl: string): Promise<McpConnection> {
  // Strip /sql suffix to get the base Torii URL that the MCP server expects
  const baseToriiUrl = toriiUrl.replace(/\/sql\/?$/, "");

  const client = new Client({ name: "axis-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

  try {
    await client.connect(transport);
  } catch (err: any) {
    console.error(`[mcp] Failed to connect to ${MCP_URL}: ${err?.message ?? err}`);
    return { tools: [], close: async () => {} };
  }

  const { tools: mcpTools } = await client.listTools();

  const tools: AgentTool<any>[] = mcpTools.map((tool) => ({
    name: tool.name.replace(/-/g, "_"),
    label: tool.title ?? tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema as any,
    async execute(_toolCallId: string, params: any) {
      // Auto-inject the connected Torii URL for query-world
      const args = tool.name === "query-world" ? { torii_url: baseToriiUrl, ...params } : params;

      const result = await client.callTool({ name: tool.name, arguments: args });
      const text =
        (result.content as any[])
          ?.filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n") ?? "";
      return {
        content: [{ type: "text" as const, text }],
        details: { source: "mcp", tool: tool.name },
      };
    },
  }));

  return {
    tools,
    close: async () => {
      try {
        await transport.close();
      } catch (_) {}
    },
  };
}
