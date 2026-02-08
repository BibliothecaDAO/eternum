import { describe, it, expect, vi } from "vitest";
import { getAvailableActions } from "../../src/adapter/action-registry";

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
    Array: (items: unknown, opts?: unknown) => ({ type: "array", items, ...(opts as any) }),
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
vi.mock("@mariozechner/pi-coding-agent", () => ({ createReadTool: () => ({}), createWriteTool: () => ({}) }));

const { createGameTools } = await import("@bibliothecadao/game-agent");

/** Helper to get schema properties from a tool */
function getSchemaProps(tool: any): Record<string, any> {
  const params = tool.parameters;
  // TypeBox Type.Object produces { type: "object", properties: {...}, required: [...] }
  return params?.properties ?? params;
}

describe("schema-registry synchronization", () => {
  it("every action in action-registry is present in the execute_action schema StringEnum", () => {
    const registeredActions = getAvailableActions();

    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;
    const props = getSchemaProps(executeTool);

    const actionTypeField = props.actionType;
    expect(actionTypeField).toBeDefined();
    expect(actionTypeField.enum).toBeDefined();
    const schemaActionTypes: string[] = actionTypeField.enum;

    // Every primary action (excluding aliases like create_trade) should be in schema
    const primaryActions = registeredActions.filter(
      (a) => !["create_trade", "accept_trade", "cancel_trade"].includes(a),
    );

    for (const action of primaryActions) {
      expect(schemaActionTypes, `Missing action "${action}" in schema`).toContain(action);
    }
  });

  it("schema ACTION_TYPES count matches expected 35 actions", () => {
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;
    const props = getSchemaProps(executeTool);

    expect(props.actionType.enum.length).toBe(35);
  });

  it("simulate_action has the same ACTION_TYPES as execute_action", () => {
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;
    const simulateTool = tools.find((t) => t.name === "simulate_action")!;

    const executeTypes = getSchemaProps(executeTool).actionType.enum;
    const simulateTypes = getSchemaProps(simulateTool).actionType.enum;

    expect(simulateTypes).toEqual(executeTypes);
  });

  it("execute_action description includes all action types", () => {
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;
    const description = executeTool.description;

    expect(description).toContain("send_resources");
    expect(description).toContain("create_explorer");
    expect(description).toContain("attack_explorer");
    expect(description).toContain("create_order");
    expect(description).toContain("create_building");
    expect(description).toContain("buy_resources");
    expect(description).toContain("create_guild");
    expect(description).toContain("upgrade_realm");
    expect(description).toContain("contribute_hyperstructure");
  });

  it("execute_action passes flat params correctly via destructuring", async () => {
    const mockExecuteAction = vi.fn().mockResolvedValue({ success: true, txHash: "0x123" });
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: mockExecuteAction,
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;

    await executeTool.execute("test-1", {
      actionType: "create_explorer",
      forStructureId: 42,
      category: 1,
      tier: 2,
      amount: 100,
      spawnDirection: 3,
    });

    expect(mockExecuteAction).toHaveBeenCalledWith({
      type: "create_explorer",
      params: {
        forStructureId: 42,
        category: 1,
        tier: 2,
        amount: 100,
        spawnDirection: 3,
      },
    });
  });

  it("simulate_action passes flat params correctly via destructuring", async () => {
    const mockSimulateAction = vi.fn().mockResolvedValue({ success: true, outcome: {} });
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: mockSimulateAction,
    };
    const tools = createGameTools(adapter as any);
    const simulateTool = tools.find((t) => t.name === "simulate_action")!;

    await simulateTool.execute("test-2", {
      actionType: "attack_guard",
      explorerId: 10,
      structureId: 20,
      structureDirection: 3,
    });

    expect(mockSimulateAction).toHaveBeenCalledWith({
      type: "attack_guard",
      params: {
        explorerId: 10,
        structureId: 20,
        structureDirection: 3,
      },
    });
  });

  it("execute_action does not include actionType in the params passed to adapter", async () => {
    const mockExecuteAction = vi.fn().mockResolvedValue({ success: true });
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: mockExecuteAction,
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;

    await executeTool.execute("test-3", {
      actionType: "leave_guild",
    });

    const call = mockExecuteAction.mock.calls[0][0];
    expect(call.type).toBe("leave_guild");
    expect(call.params).not.toHaveProperty("actionType");
  });

  it("schema has typed params for key actions", () => {
    const adapter = {
      getWorldState: vi.fn(),
      executeAction: vi.fn(),
      simulateAction: vi.fn(),
    };
    const tools = createGameTools(adapter as any);
    const executeTool = tools.find((t) => t.name === "execute_action")!;
    const props = getSchemaProps(executeTool);

    // Verify key param fields exist in the schema
    expect(props.senderEntityId).toBeDefined();
    expect(props.recipientEntityId).toBeDefined();
    expect(props.forStructureId).toBeDefined();
    expect(props.explorerId).toBeDefined();
    expect(props.directions).toBeDefined();
    expect(props.aggressorId).toBeDefined();
    expect(props.buildingCategory).toBeDefined();
    expect(props.bankEntityId).toBeDefined();
    expect(props.guildName).toBeDefined();
    expect(props.realmEntityId).toBeDefined();
    expect(props.hyperstructureEntityId).toBeDefined();
  });
});
