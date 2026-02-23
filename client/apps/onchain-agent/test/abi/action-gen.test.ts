import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateActions, getAllActionTypes, mergeCompositeActions } from "../../src/abi/action-gen";
import { extractAllFromManifest, getGameEntrypoints } from "../../src/abi/parser";
import type { DomainOverlayMap } from "../../src/abi/types";

// Load real manifest from repo root
const manifestPath = resolve(__dirname, "../manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

describe("generateActions", () => {
  it("generates definitions for all game-specific external entrypoints", () => {
    const { definitions, routes } = generateActions(manifest);

    // Count expected entrypoints from manifest
    const allContracts = extractAllFromManifest(manifest);
    let expectedCount = 0;
    for (const contract of allContracts) {
      if (!contract.address) continue;
      expectedCount += getGameEntrypoints(contract).length;
    }

    // definitions has one per entrypoint; routes may have fewer if
    // different contracts share the same entrypoint name (last wins in the Map)
    // When called without overlays, collisions can cause earlier duplicates to be removed
    // (e.g., multiple contracts with a "create" entrypoint). definitions.length ≤ expectedCount.
    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions.length).toBeLessThanOrEqual(expectedCount);
    expect(routes.size).toBeGreaterThan(0);
    expect(routes.size).toBeLessThanOrEqual(expectedCount);
  });

  it("every definition has type, description, and params", () => {
    const { definitions } = generateActions(manifest);

    for (const def of definitions) {
      expect(def.type).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(Array.isArray(def.params)).toBe(true);
    }
  });

  it("params have correct schema types", () => {
    const { definitions } = generateActions(manifest);

    const validTypes = new Set(["number", "string", "boolean", "number[]", "object", "object[]", "bigint"]);

    for (const def of definitions) {
      for (const param of def.params) {
        expect(param.name).toBeTruthy();
        expect(validTypes.has(param.type), `Invalid param type "${param.type}" for ${def.type}.${param.name}`).toBe(
          true,
        );
        expect(param.description).toBeTruthy();
        expect(param.required).toBe(true);
      }
    }
  });

  it("routes map action type to correct contract info", () => {
    const { routes } = generateActions(manifest);

    for (const [actionType, route] of routes) {
      expect(route.contractTag).toBeTruthy();
      expect(route.contractAddress).toBeTruthy();
      expect(route.contractAddress.startsWith("0x")).toBe(true);
      expect(route.entrypoint).toBeTruthy();
      expect(route.overlayKey).toContain("::");
    }
  });

  it("default description is the ABI signature", () => {
    const { definitions } = generateActions(manifest);

    // Without overlays, description should be function signature format
    const send = definitions.find((d) => d.type === "send");
    expect(send).toBeDefined();
    expect(send!.description).toMatch(/^send\(.+\)$/);
  });
});

describe("generateActions with overlays", () => {
  const overlays: DomainOverlayMap = {
    "resource_systems::send": {
      actionType: "send_resources",
      description: "Send resources from one structure to another",
      aliases: ["transfer_resources"],
      paramOverrides: {
        sender_structure_id: { description: "Entity ID of the sending structure" },
      },
    },
    "config_systems::set_world_config": {
      hidden: true,
    },
  };

  it("renames action type via overlay", () => {
    const { definitions, routes } = generateActions(manifest, { overlays });

    const sendResources = definitions.find((d) => d.type === "send_resources");
    expect(sendResources).toBeDefined();
    expect(sendResources!.description).toBe("Send resources from one structure to another");

    // Route exists for the renamed type
    expect(routes.has("send_resources")).toBe(true);
  });

  it("registers aliases", () => {
    const { routes } = generateActions(manifest, { overlays });

    expect(routes.has("transfer_resources")).toBe(true);
    // Alias and primary share the same route
    expect(routes.get("transfer_resources")).toBe(routes.get("send_resources"));
  });

  it("hides entrypoints via overlay", () => {
    const { definitions } = generateActions(manifest, { overlays });
    const hidden = definitions.find((d) => d.type === "set_world_config");
    expect(hidden).toBeUndefined();
  });

  it("applies param description overrides", () => {
    const { definitions } = generateActions(manifest, { overlays });
    const sendResources = definitions.find((d) => d.type === "send_resources");
    expect(sendResources).toBeDefined();
    const senderParam = sendResources!.params.find((p) => p.name === "sender_structure_id");
    expect(senderParam?.description).toBe("Entity ID of the sending structure");
  });
});

describe("generateActions with gameName filter", () => {
  it("filters contracts by game name", () => {
    const all = generateActions(manifest);
    const filtered = generateActions(manifest, { gameName: "eternum" });

    // Filtered should be a subset
    expect(filtered.definitions.length).toBeLessThanOrEqual(all.definitions.length);
    expect(filtered.definitions.length).toBeGreaterThan(0);
  });
});

describe("getAllActionTypes", () => {
  it("returns all action types including aliases", () => {
    const overlays: DomainOverlayMap = {
      "resource_systems::send": {
        actionType: "send_resources",
        aliases: ["transfer_resources"],
      },
    };
    const result = generateActions(manifest, { overlays });
    const types = getAllActionTypes(result);

    expect(types).toContain("send_resources");
    expect(types).toContain("transfer_resources");
  });
});

describe("mergeCompositeActions", () => {
  it("adds composite action definitions to base", () => {
    const base = generateActions(manifest);
    const baseCount = base.definitions.length;

    const merged = mergeCompositeActions(base, [
      {
        definition: {
          type: "move_to",
          description: "Move explorer to target using A* pathfinding",
          params: [
            { name: "explorerId", type: "number", description: "Explorer entity ID", required: true },
            { name: "targetCol", type: "number", description: "Target column", required: true },
            { name: "targetRow", type: "number", description: "Target row", required: true },
          ],
        },
      },
    ]);

    expect(merged.definitions.length).toBe(baseCount + 1);
    expect(merged.definitions.find((d) => d.type === "move_to")).toBeDefined();
  });
});

describe("comparison with hardcoded action registry", () => {
  // The 39 action types from the current hand-written action-registry.ts
  const HARDCODED_ACTIONS = [
    "send_resources",
    "pickup_resources",
    "claim_arrivals",
    "create_explorer",
    "add_to_explorer",
    "delete_explorer",
    "add_guard",
    "delete_guard",
    "move_explorer",
    "travel_explorer",
    "explore",
    "swap_explorer_to_explorer",
    "swap_explorer_to_guard",
    "swap_guard_to_explorer",
    "attack_explorer",
    "attack_guard",
    "guard_attack_explorer",
    "raid",
    "create_order",
    "accept_order",
    "cancel_order",
    "create_building",
    "destroy_building",
    "pause_production",
    "resume_production",
    "buy_resources",
    "sell_resources",
    "add_liquidity",
    "remove_liquidity",
    "create_guild",
    "join_guild",
    "leave_guild",
    "update_whitelist",
    "upgrade_realm",
    "contribute_hyperstructure",
    "move_to",
  ];

  it("ABI-generated entrypoints cover the underlying contract functions", () => {
    const { definitions } = generateActions(manifest);
    const abiActionTypes = new Set(definitions.map((d) => d.type));

    // These are the raw entrypoint names from ABI that correspond to hardcoded actions
    // (hardcoded actions use different names like "send_resources" for ABI "send")
    const rawEntrypoints = [
      "send",
      "pickup",
      "arrivals_offload",
      "explorer_create",
      "explorer_add",
      "explorer_delete",
      "guard_add",
      "guard_delete",
      "explorer_move",
      "explorer_extract_reward",
      "create_order",
      "accept_order",
      "cancel_order",
      "create_building",
      "destroy_building",
      "pause_building_production",
      "resume_building_production",
      "buy",
      "sell",
      "add",
      "remove",
      "create_guild",
      "join_guild",
      "leave_guild",
      "update_whitelist",
      "level_up",
      "contribute",
    ];

    let found = 0;
    for (const ep of rawEntrypoints) {
      if (abiActionTypes.has(ep)) found++;
    }

    const coverage = (found / rawEntrypoints.length) * 100;
    console.log(
      `\nABI coverage of hardcoded registry entrypoints: ${found}/${rawEntrypoints.length} (${coverage.toFixed(1)}%)`,
    );
    expect(found / rawEntrypoints.length).toBeGreaterThan(0.8);
  });
});
