import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchRecentWorldChat } from "./fetch-world-chat";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeInput(overrides: Partial<Parameters<typeof fetchRecentWorldChat>[0]> = {}) {
  return {
    realtimeServerUrl: "http://localhost:3000",
    zoneId: "global",
    agentId: "agent-42",
    limit: 10,
    ...overrides,
  };
}

function okResponse(messages: any[]) {
  return {
    ok: true,
    json: async () => ({ messages }),
  };
}

describe("fetchRecentWorldChat", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("constructs correct URL with zoneId and limit params", async () => {
    mockFetch.mockResolvedValue(okResponse([]));
    await fetchRecentWorldChat(makeInput({ zoneId: "agents:global", limit: 5 }));

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/chat/world");
    expect(calledUrl.searchParams.get("zoneId")).toBe("agents:global");
    expect(calledUrl.searchParams.get("limit")).toBe("5");
  });

  it('passes x-player-id header as "agent:<agentId>"', async () => {
    mockFetch.mockResolvedValue(okResponse([]));
    await fetchRecentWorldChat(makeInput({ agentId: "bot-7" }));

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["x-player-id"]).toBe("agent:bot-7");
  });

  it("filters out messages from own agent", async () => {
    mockFetch.mockResolvedValue(
      okResponse([
        { senderId: "agent:agent-42", content: "my own msg", createdAt: "2026-01-01T00:00:00Z" },
        { senderId: "player-1", content: "other msg", createdAt: "2026-01-01T00:00:01Z" },
      ]),
    );

    const result = await fetchRecentWorldChat(makeInput());
    expect(result).toHaveLength(1);
    expect(result[0].senderId).toBe("player-1");
  });

  it("returns [] when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const result = await fetchRecentWorldChat(makeInput());
    expect(result).toEqual([]);
  });

  it("returns [] when response is not ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchRecentWorldChat(makeInput());
    expect(result).toEqual([]);
  });

  it("returns messages in chronological order (reversed from API desc order)", async () => {
    mockFetch.mockResolvedValue(
      okResponse([
        { senderId: "p2", content: "newer", createdAt: "2026-01-01T00:00:02Z" },
        { senderId: "p1", content: "older", createdAt: "2026-01-01T00:00:01Z" },
      ]),
    );

    const result = await fetchRecentWorldChat(makeInput());
    expect(result[0].content).toBe("older");
    expect(result[1].content).toBe("newer");
  });
});
