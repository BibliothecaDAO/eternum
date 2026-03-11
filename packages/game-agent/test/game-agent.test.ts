import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prompt: vi.fn(),
}));

vi.mock("@mariozechner/pi-agent-core", () => {
  class Agent {
    state: any;

    constructor(options: any) {
      this.state = options.initialState;
    }

    prompt = (...args: any[]) => mocks.prompt(...args);
    setSystemPrompt = vi.fn();
    setTools = vi.fn();
    setModel = vi.fn();
    abort = vi.fn();
  }

  return { Agent };
});

import { createGameAgent } from "../src/game-agent";

describe("createGameAgent queueing", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("continues processing prompts after one prompt fails", async () => {
    mocks.prompt.mockRejectedValueOnce(new Error("llm failure")).mockResolvedValueOnce(undefined);

    const adapter = {
      getWorldState: vi.fn().mockResolvedValue({ tick: 1, timestamp: Date.now(), entities: [] }),
      executeAction: vi.fn(),
      simulateAction: vi.fn(),
    };

    const game = createGameAgent({
      adapter: adapter as any,
      dataDir: "/tmp/does-not-exist",
      includeDataTools: false,
      extraTools: [],
    });

    await expect(game.enqueuePrompt("first prompt")).rejects.toThrow("llm failure");
    await expect(game.enqueuePrompt("second prompt")).resolves.toBeUndefined();
    expect(mocks.prompt).toHaveBeenCalledTimes(2);
  });
});
