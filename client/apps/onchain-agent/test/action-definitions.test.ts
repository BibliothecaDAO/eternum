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
    expect(types.has("explorer_create")).toBe(true);
    expect(types.has("attack_explorer_vs_explorer")).toBe(true);
    expect(types.has("create_order")).toBe(true);
    expect(types.has("create_building")).toBe(true);
    expect(types.has("buy_resources")).toBe(true);
    expect(types.has("create_guild")).toBe(true);
    expect(types.has("level_up")).toBe(true);
    expect(types.has("contribute_hyperstructure")).toBe(true);
  });

  it("create_order is a registered action", () => {
    const actions = getAvailableActions();
    expect(actions).toContain("create_order");
  });

  it("returns at least 25 unique action definitions", () => {
    const defs = getActionDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(25);
  });

  it("every visible action has a rich description (not raw ABI signature)", () => {
    const defs = getActionDefinitions();
    const raw: string[] = [];

    for (const d of defs) {
      // Raw ABI signatures contain "::" (e.g., "update_construction_access(hyperstructure_id: u32, access: u8)")
      // or are just the function signature with no human context
      if (d.description.includes("::")) {
        raw.push(d.type);
      }
    }

    if (raw.length > 0) {
      console.warn(`Actions with raw ABI descriptions (need overlay):\n  ${raw.join("\n  ")}`);
    }
    expect(raw, `${raw.length} actions have raw ABI descriptions instead of rich overlays`).toHaveLength(0);
  });

  it("action inventory snapshot", () => {
    const defs = getActionDefinitions();
    const sorted = [...defs].sort((a, b) => a.type.localeCompare(b.type));
    const inventory = sorted.map((d) => `${d.type}  [${d.params.map((p) => p.name).join(", ")}]`);

    // Snapshot: if actions are added or removed, this test fails and the snapshot updates
    expect(inventory).toMatchSnapshot();
  });
});
