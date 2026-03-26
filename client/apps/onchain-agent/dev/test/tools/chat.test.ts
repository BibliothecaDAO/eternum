import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWorldChat } from "../../../src/tools/core/chat";
import type { ToolContext } from "../../../src/tools/core/context";
import { publishAgentWorldChat } from "@bibliothecadao/agent-runtime";

vi.mock("@bibliothecadao/agent-runtime", () => ({
  publishAgentWorldChat: vi.fn(),
}));

const mockedPublish = vi.mocked(publishAgentWorldChat);

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    realtimeServerUrl: "http://localhost:3000",
    agentId: "agent-1",
    agentKind: "player",
    ...overrides,
  } as unknown as ToolContext;
}

describe("sendWorldChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns failure when realtimeServerUrl not set", async () => {
    const result = await sendWorldChat(
      { content: "hello" },
      makeCtx({ realtimeServerUrl: undefined }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("realtime server URL not configured");
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("returns failure when agentId not set", async () => {
    const result = await sendWorldChat(
      { content: "hello" },
      makeCtx({ agentId: undefined }),
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("agent ID not configured");
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it("calls publishAgentWorldChat with correct params", async () => {
    mockedPublish.mockResolvedValue(undefined);
    await sendWorldChat({ content: "hi there", zoneId: "zone-42" }, makeCtx());
    expect(mockedPublish).toHaveBeenCalledWith({
      baseUrl: "http://localhost:3000",
      zoneId: "zone-42",
      content: "hi there",
      agentId: "agent-1",
      kind: "player",
    });
  });

  it("defaults zoneId to 'global' when not provided", async () => {
    mockedPublish.mockResolvedValue(undefined);
    await sendWorldChat({ content: "hello" }, makeCtx());
    expect(mockedPublish).toHaveBeenCalledWith(
      expect.objectContaining({ zoneId: "global" }),
    );
  });

  it("returns success message on successful publish", async () => {
    mockedPublish.mockResolvedValue(undefined);
    const result = await sendWorldChat({ content: "hello", zoneId: "lobby" }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toBe('Message sent to zone "lobby".');
  });

  it("returns failure with error message when publish throws", async () => {
    mockedPublish.mockRejectedValue(new Error("connection refused"));
    const result = await sendWorldChat({ content: "hello" }, makeCtx());
    expect(result.success).toBe(false);
    expect(result.message).toContain("connection refused");
  });
});
