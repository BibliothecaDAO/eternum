import { describe, expect, it, vi } from "vitest";
import {
  getAvailableActions,
  executeAction,
} from "../../src/adapter/action-registry";
import { createMockClient, mockSigner } from "../utils/mock-client";

vi.mock("@bibliothecadao/client", () => ({
  computeStrength: (count: number, tier: number) => count * tier * 10,
  computeOutputAmount: () => 0,
  computeBuildingCost: () => [],
}));

vi.mock("@sinclair/typebox", () => ({
  Type: {
    Object: (value: unknown) => value,
    Optional: (value: unknown) => value,
    String: (opts?: unknown) => ({ type: "string", ...(opts as any) }),
    Number: (opts?: unknown) => ({ type: "number", ...(opts as any) }),
    Boolean: (opts?: unknown) => ({ type: "boolean", ...(opts as any) }),
    Record: () => ({}),
    Array: (value: unknown, opts?: unknown) => ({ type: "array", items: value, ...(opts as any) }),
    Unknown: () => ({}),
  },
}));

vi.mock("@mariozechner/pi-agent-core", () => ({ Agent: class {} }));
vi.mock("@mariozechner/pi-ai", () => ({
  StringEnum: (values: readonly string[], opts?: unknown) => ({
    type: "string",
    enum: [...values],
    ...((opts as any) ?? {}),
  }),
}));
vi.mock("@mariozechner/pi-coding-agent", () => ({
  createReadTool: () => ({}),
  createWriteTool: () => ({}),
}));

const { createGameTools } = await import("@bibliothecadao/game-agent");

// ---------------------------------------------------------------------------
// Extract the ACTION_TYPES enum from the tools schema
// ---------------------------------------------------------------------------

function getActionTypesFromSchema(): string[] {
  // We need a minimal adapter to create the tools
  const adapter = {
    getWorldState: vi.fn().mockResolvedValue({ tick: 1, timestamp: 1, entities: [], resources: new Map() }),
    executeAction: vi.fn().mockResolvedValue({ success: true }),
    simulateAction: vi.fn().mockResolvedValue({ success: true }),
  };
  const tools = createGameTools(adapter);
  const executeTool = tools.find((t) => t.name === "execute_action")!;
  const schema = executeTool.parameters as any;
  // With mocked Type.Object, schema IS the raw properties object.
  // actionType is the result of StringEnum(...) which is { type: "string", enum: [...] }
  // But Type.Object wraps its first arg, so we need to check the structure.
  // If schema is a TypeBox-style object, it may have .properties
  const actionTypeField = schema?.actionType ?? schema?.properties?.actionType;
  return actionTypeField?.enum ?? [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("schema ↔ action-registry sync", () => {
  it("every action in the StringEnum is registered in action-registry", () => {
    const schemaActions = getActionTypesFromSchema();
    const registeredActions = getAvailableActions();

    // Every schema action must have a handler in the registry.
    // The registry may have extra aliases (create_trade, accept_trade, cancel_trade)
    // that are not in the schema, but every schema entry must be registered.
    for (const action of schemaActions) {
      expect(
        registeredActions,
        `Schema action "${action}" is NOT registered in action-registry`,
      ).toContain(action);
    }
  });

  it("every non-alias registered action is present in the StringEnum", () => {
    const schemaActions = getActionTypesFromSchema();
    const registeredActions = getAvailableActions();

    // Known aliases that exist in the registry but not in the schema
    const knownAliases = new Set(["create_trade", "accept_trade", "cancel_trade"]);

    for (const action of registeredActions) {
      if (knownAliases.has(action)) continue;
      expect(
        schemaActions,
        `Registered action "${action}" is missing from the StringEnum in tools.ts`,
      ).toContain(action);
    }
  });

  it("StringEnum contains exactly 35 action types", () => {
    const schemaActions = getActionTypesFromSchema();
    expect(schemaActions.length).toBe(35);
  });
});

describe("execute_action { actionType, ...params } destructuring", () => {
  it("passes typed params directly to handler (create_explorer)", async () => {
    const client = createMockClient() as any;
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn().mockImplementation(async (action: any) => {
        // Forward to the real executeAction so we can verify params reach the client
        return executeAction(client, mockSigner, action);
      }),
      simulateAction: vi.fn(),
    };

    const tools = createGameTools(adapter);
    const executeTool = tools.find((t) => t.name === "execute_action")!;

    // Simulate what the LLM sends: flat params with actionType
    await executeTool.execute("test-call", {
      actionType: "create_explorer",
      forStructureId: 123,
      category: 1,
      tier: 1,
      amount: 10,
      spawnDirection: 0,
    });

    // The adapter.executeAction receives { type, params } with actionType stripped
    expect(adapter.executeAction).toHaveBeenCalledOnce();
    const call = adapter.executeAction.mock.calls[0][0];
    expect(call.type).toBe("create_explorer");
    // Params should NOT contain actionType
    expect(call.params.actionType).toBeUndefined();
    // Params should contain all the rest
    expect(call.params.forStructureId).toBe(123);
    expect(call.params.category).toBe(1);
    expect(call.params.tier).toBe(1);
    expect(call.params.amount).toBe(10);
    expect(call.params.spawnDirection).toBe(0);
  });

  it("passes typed params directly to handler (send_resources)", async () => {
    const client = createMockClient() as any;
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn().mockImplementation(async (action: any) => {
        return executeAction(client, mockSigner, action);
      }),
      simulateAction: vi.fn(),
    };

    const tools = createGameTools(adapter);
    const executeTool = tools.find((t) => t.name === "execute_action")!;

    await executeTool.execute("test-call-2", {
      actionType: "send_resources",
      senderEntityId: 10,
      recipientEntityId: 20,
      resources: [{ resourceType: 1, amount: 500 }],
    });

    expect(adapter.executeAction).toHaveBeenCalledOnce();
    const call = adapter.executeAction.mock.calls[0][0];
    expect(call.type).toBe("send_resources");
    expect(call.params.senderEntityId).toBe(10);
    expect(call.params.recipientEntityId).toBe(20);
    expect(call.params.resources).toEqual([{ resourceType: 1, amount: 500 }]);

    // Verify it actually reached the client
    expect(client.resources.send).toHaveBeenCalledOnce();
    const [, sendProps] = client.resources.send.mock.calls[0];
    expect(sendProps.senderEntityId).toBe(10);
    expect(sendProps.recipientEntityId).toBe(20);
  });

  it("passes typed params directly to handler (attack_explorer with stealResources)", async () => {
    const client = createMockClient() as any;
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn().mockImplementation(async (action: any) => {
        return executeAction(client, mockSigner, action);
      }),
      simulateAction: vi.fn(),
    };

    const tools = createGameTools(adapter);
    const executeTool = tools.find((t) => t.name === "execute_action")!;

    await executeTool.execute("test-call-3", {
      actionType: "attack_explorer",
      aggressorId: 100,
      defenderId: 200,
      defenderDirection: 1,
      stealResources: [{ resourceId: 3, amount: 50 }],
    });

    expect(adapter.executeAction).toHaveBeenCalledOnce();
    const call = adapter.executeAction.mock.calls[0][0];
    expect(call.type).toBe("attack_explorer");
    expect(call.params.aggressorId).toBe(100);
    expect(call.params.stealResources).toEqual([{ resourceId: 3, amount: 50 }]);

    expect(client.combat.attackExplorer).toHaveBeenCalledOnce();
    const [, attackProps] = client.combat.attackExplorer.mock.calls[0];
    expect(attackProps.aggressorId).toBe(100);
    expect(attackProps.defenderId).toBe(200);
    expect(attackProps.stealResources).toEqual([{ resourceId: 3, amount: 50 }]);
  });

  it("simulate_action also uses { actionType, ...params } destructuring", async () => {
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: vi.fn().mockResolvedValue({
        success: true,
        outcome: { message: "simulated" },
      }),
    };

    const tools = createGameTools(adapter);
    const simulateTool = tools.find((t) => t.name === "simulate_action")!;

    await simulateTool.execute("sim-1", {
      actionType: "move_explorer",
      explorerId: 42,
      directions: [1, 2, 3],
      explore: true,
    });

    expect(adapter.simulateAction).toHaveBeenCalledOnce();
    const call = adapter.simulateAction.mock.calls[0][0];
    expect(call.type).toBe("move_explorer");
    expect(call.params.actionType).toBeUndefined();
    expect(call.params.explorerId).toBe(42);
    expect(call.params.directions).toEqual([1, 2, 3]);
    expect(call.params.explore).toBe(true);
  });
});
