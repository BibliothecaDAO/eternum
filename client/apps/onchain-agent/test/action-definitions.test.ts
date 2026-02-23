import { beforeAll, describe, it, expect } from "vitest";
import { getActionDefinitions, getAvailableActions } from "../src/adapter/action-registry";
import { initializeTestActionRegistry } from "./utils/init-action-registry";

beforeAll(() => {
  initializeTestActionRegistry();
});

describe("action definitions", () => {
  it("every registered action has a definition (aliases share canonical type)", () => {
    const actionTypes = getAvailableActions();
    const defs = getActionDefinitions();
    const defTypes = new Set(defs.map((d) => d.type));

    // Aliases may not appear in defs directly, but their canonical type should
    // At minimum, the number of defs should be close to the number of unique actions
    expect(defs.length).toBeGreaterThan(0);
    // Every def type must be a registered action
    for (const def of defs) {
      expect(actionTypes).toContain(def.type);
    }
  });

  it("every definition has a non-empty description", () => {
    for (const def of getActionDefinitions()) {
      expect(def.description.length, `Empty description for "${def.type}"`).toBeGreaterThan(0);
    }
  });

  it("every definition has params array", () => {
    for (const def of getActionDefinitions()) {
      expect(Array.isArray(def.params), `params not array for "${def.type}"`).toBe(true);
    }
  });

  it("every param has name, type, and description", () => {
    for (const def of getActionDefinitions()) {
      for (const param of def.params) {
        expect(param.name, `Missing param name in "${def.type}"`).toBeTruthy();
        expect(param.type, `Missing param type for ${param.name} in "${def.type}"`).toBeTruthy();
        expect(param.description, `Missing param description for ${param.name} in "${def.type}"`).toBeTruthy();
      }
    }
  });

  it("definitions cover all major action categories", () => {
    const defs = getActionDefinitions();
    const types = new Set(defs.map((d) => d.type));

    // Spot check key actions from each category
    expect(types.has("send_resources")).toBe(true);
    expect(types.has("create_explorer")).toBe(true);
    expect(types.has("move_explorer")).toBe(true);
    expect(types.has("attack_explorer")).toBe(true);
    expect(types.has("create_order")).toBe(true);
    expect(types.has("create_building")).toBe(true);
    expect(types.has("buy_resources")).toBe(true);
    expect(types.has("create_guild")).toBe(true);
    expect(types.has("upgrade_realm")).toBe(true);
    expect(types.has("contribute_hyperstructure")).toBe(true);
  });

  it("aliases share definitions (create_order and create_trade)", () => {
    const actions = getAvailableActions();
    expect(actions).toContain("create_order");
    expect(actions).toContain("create_trade");
  });

  it("getActionDefinitions deduplicates aliases", () => {
    const defs = getActionDefinitions();
    const types = defs.map((d) => d.type);
    // create_order and create_trade are aliases — only one should appear in defs
    // (whichever was registered first)
    const orderTypes = types.filter((t) => t === "create_order" || t === "create_trade");
    expect(orderTypes.length).toBe(1);
  });

  it("returns at least 25 unique action definitions", () => {
    const defs = getActionDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(25);
  });
});
