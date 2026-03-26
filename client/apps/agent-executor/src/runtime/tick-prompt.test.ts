import { describe, expect, it } from "vitest";
import { buildTickPrompt } from "./tick-prompt";
import type { WorldChatEntry } from "./fetch-world-chat";

describe("buildTickPrompt", () => {
  it('returns "Map not yet loaded..." when briefing is null', () => {
    const result = buildTickPrompt(null, [], "");
    expect(result).toBe("Map not yet loaded. Wait for next tick.");
  });

  it('returns "Map not yet loaded..." when briefing is undefined', () => {
    const result = buildTickPrompt(undefined as any, [], "");
    expect(result).toBe("Map not yet loaded. Wait for next tick.");
  });

  it('includes JSON.stringify(briefing) under "## Tick" header', () => {
    const briefing = { health: 100, position: { x: 1, y: 2 } };
    const result = buildTickPrompt(briefing, [], "");
    expect(result).toContain("## Tick");
    expect(result).toContain(JSON.stringify(briefing, null, 2));
  });

  it('includes "## Memory" section when memory is non-empty string', () => {
    const result = buildTickPrompt({ a: 1 }, [], "Remember to explore north");
    expect(result).toContain("## Memory");
    expect(result).toContain("Remember to explore north");
  });

  it('omits "## Memory" when memory is empty string', () => {
    const result = buildTickPrompt({ a: 1 }, [], "");
    expect(result).not.toContain("## Memory");
  });

  it('includes "## Recent Errors" with "- <tool>: <error>" lines when toolErrors non-empty', () => {
    const errors = [
      { tool: "move", error: "not adjacent" },
      { tool: "attack", error: "no stamina" },
    ];
    const result = buildTickPrompt({ a: 1 }, errors, "");
    expect(result).toContain("## Recent Errors");
    expect(result).toContain("- move: not adjacent");
    expect(result).toContain("- attack: no stamina");
  });

  it('omits "## Recent Errors" when toolErrors is empty', () => {
    const result = buildTickPrompt({ a: 1 }, [], "");
    expect(result).not.toContain("## Recent Errors");
  });

  it('always includes "## Constraints" section', () => {
    const result = buildTickPrompt({ a: 1 }, [], "");
    expect(result).toContain("## Constraints");
  });

  it('ends with "Act on threats first, then opportunities..."', () => {
    const result = buildTickPrompt({ a: 1 }, [], "");
    expect(result).toMatch(/Act on threats first, then opportunities.*$/);
  });
});

describe("buildTickPrompt - chat messages", () => {
  const makeChatMsg = (overrides: Partial<WorldChatEntry> = {}): WorldChatEntry => ({
    senderId: "player-123",
    content: "hello world",
    createdAt: "2026-03-26T12:30:45Z",
    ...overrides,
  });

  it('includes "## World Chat (recent)" when chatMessages has entries', () => {
    const result = buildTickPrompt({ a: 1 }, [], "", [makeChatMsg()]);
    expect(result).toContain("## World Chat (recent)");
  });

  it("omits chat section when chatMessages is undefined", () => {
    const result = buildTickPrompt({ a: 1 }, [], "", undefined);
    expect(result).not.toContain("## World Chat (recent)");
  });

  it("omits chat section when chatMessages is empty array", () => {
    const result = buildTickPrompt({ a: 1 }, [], "", []);
    expect(result).not.toContain("## World Chat (recent)");
  });

  it('formats messages as "- [HH:MM:SS] sender: content"', () => {
    const result = buildTickPrompt({ a: 1 }, [], "", [
      makeChatMsg({ senderId: "player-1", content: "attack now", createdAt: "2026-03-26T14:05:30Z" }),
    ]);
    expect(result).toContain("- [14:05:30] player-1: attack now");
  });

  it("uses senderDisplayName when available, falls back to senderId", () => {
    const withName = makeChatMsg({ senderId: "player-1", senderDisplayName: "Alice", content: "hi" });
    const withoutName = makeChatMsg({ senderId: "player-2", senderDisplayName: undefined, content: "bye" });
    const result = buildTickPrompt({ a: 1 }, [], "", [withName, withoutName]);
    expect(result).toContain("Alice: hi");
    expect(result).toContain("player-2: bye");
  });
});
