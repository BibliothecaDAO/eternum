import { describe, expect, it, vi } from "vitest";

import type { SteeringJobType } from "@bibliothecadao/types";

import type { SteeringOverlay, SteeringOverlayResolver } from "./types";

import {
  applySteeringOverlay,
  buildSteeringMemoryNote,
  buildSteeringPromptSupplement,
  createSteeringOverlay,
  getSteeringLabel,
  resolveSteeringOverlay,
} from "./steering";

describe("getSteeringLabel", () => {
  it.each([
    ["scout", "Scout"],
    ["defend", "Defend"],
    ["gather", "Gather"],
    ["expand", "Expand"],
    ["support", "Support"],
    ["custom", "Custom"],
  ] as [SteeringJobType, string][])("returns '%s' -> '%s'", (mode, expected) => {
    expect(getSteeringLabel(mode)).toBe(expected);
  });
});

describe("createSteeringOverlay", () => {
  it("returns template summary/promptSupplement/taskOverrides/runtimeConfigOverrides for non-custom types", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    expect(overlay.summary).toBe("Favor reconnaissance, unexplored spaces, and nearby threat discovery.");
    expect(overlay.promptSupplement).toContain("scouting unexplored");
    expect(overlay.taskOverrides).toEqual({ exploration: "high", combat: "medium", economy: "low" });
    expect(overlay.runtimeConfigOverrides).toEqual({ maxToolCalls: 4 });
  });

  it("scout: runtimeConfigOverrides.maxToolCalls === 4", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    expect(overlay.runtimeConfigOverrides.maxToolCalls).toBe(4);
  });

  it("defend: runtimeConfigOverrides.maxMutatingActionGroups === 2", () => {
    const overlay = createSteeringOverlay({ jobType: "defend" });
    expect(overlay.runtimeConfigOverrides.maxMutatingActionGroups).toBe(2);
  });

  it("gather: runtimeConfigOverrides.maxToolCalls === 6", () => {
    const overlay = createSteeringOverlay({ jobType: "gather" });
    expect(overlay.runtimeConfigOverrides.maxToolCalls).toBe(6);
  });

  it("sets updatedAt to provided value when given", () => {
    const ts = "2025-01-01T00:00:00.000Z";
    const overlay = createSteeringOverlay({ jobType: "scout", updatedAt: ts });
    expect(overlay.updatedAt).toBe(ts);
  });

  it("defaults updatedAt to ISO timestamp when omitted", () => {
    const before = new Date().toISOString();
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const after = new Date().toISOString();
    expect(overlay.updatedAt >= before).toBe(true);
    expect(overlay.updatedAt <= after).toBe(true);
  });

  it('custom with objective: summary = "Favor the custom objective: <text>"', () => {
    const overlay = createSteeringOverlay({
      jobType: "custom",
      config: { objective: "take over the world" },
    });
    expect(overlay.summary).toBe("Favor the custom objective: take over the world");
  });

  it('custom with objective: promptSupplement ends with "Active objective: <text>"', () => {
    const overlay = createSteeringOverlay({
      jobType: "custom",
      config: { objective: "take over the world" },
    });
    expect(overlay.promptSupplement).toMatch(/Active objective: take over the world$/);
  });

  it('custom with objective: memoryNote = "Current steering: <text>"', () => {
    const overlay = createSteeringOverlay({
      jobType: "custom",
      config: { objective: "take over the world" },
    });
    expect(overlay.memoryNote).toBe("Current steering: take over the world");
  });

  it("custom without objective: uses template defaults", () => {
    const overlay = createSteeringOverlay({ jobType: "custom" });
    expect(overlay.summary).toBe("Favor the player-specified objective while preserving autonomous judgment.");
    expect(overlay.promptSupplement).toBe(
      "Bias toward the current custom objective while preserving autonomous judgment, safety, and tactical sanity.",
    );
    expect(overlay.memoryNote).toBe("Current steering: follow the current custom objective without becoming overly rigid.");
  });

  it("custom objective: trims whitespace, collapses spaces, truncates at 240 chars", () => {
    const longText = "a".repeat(300);
    const overlay = createSteeringOverlay({
      jobType: "custom",
      config: { objective: `  ${longText}  ` },
    });
    // The sanitized objective should be 240 chars
    expect(overlay.summary).toBe(`Favor the custom objective: ${"a".repeat(240)}`);
  });

  it("custom with whitespace-only objective: treated as no objective", () => {
    const overlay = createSteeringOverlay({
      jobType: "custom",
      config: { objective: "   " },
    });
    // Falls back to template defaults
    expect(overlay.summary).toBe("Favor the player-specified objective while preserving autonomous judgment.");
  });
});

describe("buildSteeringPromptSupplement", () => {
  it('returns "" for null overlay', () => {
    expect(buildSteeringPromptSupplement(null)).toBe("");
  });

  it('returns "" for undefined overlay', () => {
    expect(buildSteeringPromptSupplement(undefined)).toBe("");
  });

  it('returns "## Steering\\n<supplement>" for valid overlay', () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const result = buildSteeringPromptSupplement(overlay);
    expect(result).toBe(`## Steering\n${overlay.promptSupplement}`);
  });
});

describe("buildSteeringMemoryNote", () => {
  it("returns null for null overlay", () => {
    expect(buildSteeringMemoryNote(null)).toBeNull();
  });

  it("returns null for undefined overlay", () => {
    expect(buildSteeringMemoryNote(undefined)).toBeNull();
  });

  it("returns null for whitespace-only memoryNote", () => {
    const overlay: SteeringOverlay = {
      jobType: "scout",
      summary: "test",
      promptSupplement: "test",
      taskOverrides: {},
      runtimeConfigOverrides: {},
      memoryNote: "   ",
      updatedAt: new Date().toISOString(),
    };
    expect(buildSteeringMemoryNote(overlay)).toBeNull();
  });

  it("returns memoryNote string for valid overlay", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const result = buildSteeringMemoryNote(overlay);
    expect(result).toBe("Current steering: scout nearby territory and surface actionable map intelligence.");
  });
});

describe("applySteeringOverlay", () => {
  it("returns context unchanged for null overlay", () => {
    const ctx = { runtimeConfig: { maxToolCalls: 10 }, prompt: "hello" };
    expect(applySteeringOverlay(ctx, null)).toBe(ctx);
  });

  it("returns context unchanged for undefined overlay", () => {
    const ctx = { runtimeConfig: { maxToolCalls: 10 }, prompt: "hello" };
    expect(applySteeringOverlay(ctx, undefined)).toBe(ctx);
  });

  it("merges runtimeConfigOverrides into context.runtimeConfig", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const ctx = { runtimeConfig: { maxToolCalls: 10 }, prompt: "hello" };
    const result = applySteeringOverlay(ctx, overlay);
    expect(result.runtimeConfig?.maxToolCalls).toBe(4);
  });

  it("preserves existing runtimeConfig fields not in overrides", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const ctx = { runtimeConfig: { maxToolCalls: 10, turnTimeoutMs: 5000 }, prompt: "hello" };
    const result = applySteeringOverlay(ctx, overlay);
    expect(result.runtimeConfig?.turnTimeoutMs).toBe(5000);
    expect(result.runtimeConfig?.maxToolCalls).toBe(4);
  });

  it("prepends steering supplement to existing prompt", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const ctx = { runtimeConfig: {}, prompt: "do stuff" };
    const result = applySteeringOverlay(ctx, overlay);
    expect(result.prompt).toContain("## Steering");
    expect(result.prompt!.endsWith("do stuff")).toBe(true);
  });

  it("does not add prompt key when context has no prompt", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const ctx = { runtimeConfig: {} };
    const result = applySteeringOverlay(ctx, overlay);
    expect("prompt" in result).toBe(false);
  });

  it("does not mutate original context (spread creates new object)", () => {
    const overlay = createSteeringOverlay({ jobType: "scout" });
    const ctx = { runtimeConfig: { maxToolCalls: 10 }, prompt: "hello" };
    const result = applySteeringOverlay(ctx, overlay);
    expect(result).not.toBe(ctx);
    expect(ctx.runtimeConfig.maxToolCalls).toBe(10);
  });
});

describe("resolveSteeringOverlay", () => {
  it("returns null when resolver is undefined", async () => {
    const result = await resolveSteeringOverlay("agent-1", "world-1", undefined);
    expect(result).toBeNull();
  });

  it("calls resolver.load with {agentId, worldId} and returns result", async () => {
    const overlay = createSteeringOverlay({ jobType: "defend" });
    const resolver: SteeringOverlayResolver = {
      load: vi.fn().mockResolvedValue(overlay),
    };
    const result = await resolveSteeringOverlay("agent-1", "world-1", resolver);
    expect(resolver.load).toHaveBeenCalledWith({ agentId: "agent-1", worldId: "world-1" });
    expect(result).toBe(overlay);
  });
});
