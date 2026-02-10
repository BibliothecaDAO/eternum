import { describe, expect, it, vi } from "vitest";
import { EternumGameAdapter } from "../../src/adapter/eternum-adapter";
import { createMockClient, mockSigner } from "../utils/mock-client";

vi.mock("@bibliothecadao/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/client")>();
  return {
    ...actual,
    computeStrength: (count: number, tier: number) => count * tier * 10,
    computeOutputAmount: () => 0,
    computeBuildingCost: () => [],
  };
});

vi.mock("@sinclair/typebox", () => ({
  Type: {
    Object: (value: unknown) => value,
    Optional: (value: unknown) => value,
    String: () => ({}),
    Number: () => ({}),
    Boolean: () => ({}),
    Record: () => ({}),
    Array: (value: unknown) => value,
    Unknown: () => ({}),
  },
}));

vi.mock("@mariozechner/pi-agent-core", () => ({ Agent: class {} }));
vi.mock("@mariozechner/pi-ai", () => ({
  StringEnum: (values: readonly string[], opts?: unknown) => ({ type: "string", enum: values, ...((opts as any) ?? {}) }),
}));
vi.mock("@mariozechner/pi-coding-agent", () => ({ createReadTool: () => ({}), createWriteTool: () => ({}) }));

const { createGameTools } = await import("@bibliothecadao/game-agent");

function getText(toolResult: any): string {
  const first = toolResult?.content?.[0];
  if (!first || first.type !== "text") {
    throw new Error("Expected first tool result content item to be text");
  }
  return first.text;
}

describe("pi package integration", () => {
  it("runs pi tools against the Eternum adapter end-to-end", async () => {
    const client = createMockClient() as any;
    const adapter = new EternumGameAdapter(client, mockSigner, "0xdeadbeef");
    const tools = createGameTools(adapter);

    const observeTool = tools.find((tool) => tool.name === "observe_game");
    const executeTool = tools.find((tool) => tool.name === "execute_action");
    const simulateTool = tools.find((tool) => tool.name === "simulate_action");

    expect(observeTool).toBeDefined();
    expect(executeTool).toBeDefined();
    expect(simulateTool).toBeDefined();

    const observed = JSON.parse(getText(await observeTool!.execute("observe-1", {})));
    expect(observed.player.address).toBe("0xdeadbeef");
    expect(observed.resources.Wood).toBe(500);

    const executed = JSON.parse(
      getText(
        await executeTool!.execute("execute-1", {
          actionType: "move_explorer",
          explorerId: "42",
          directions: ["1", "2"],
          explore: "true",
        }),
      ),
    );

    expect(executed.success).toBe(true);
    expect(client.troops.move).toHaveBeenCalledOnce();
    const [, moveProps] = client.troops.move.mock.calls[0];
    expect(moveProps).toEqual({ explorerId: 42, directions: [1, 2], explore: true });

    const simulated = JSON.parse(
      getText(
        await simulateTool!.execute("simulate-1", {
          actionType: "leave_guild",
        }),
      ),
    );

    expect(simulated.success).toBe(true);
    expect(simulated.outcome.message).toContain("No simulation model");
  });
});
