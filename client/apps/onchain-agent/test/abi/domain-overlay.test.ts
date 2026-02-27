import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateActions } from "../../src/abi/action-gen";
import { extractAllFromManifest, getGameEntrypoints } from "../../src/abi/parser";
import {
  ETERNUM_OVERLAYS,
  HIDDEN_SUFFIXES,
  createHiddenOverlays,
  RESOURCE_PRECISION,
  num,
  precisionAmount,
  bool,
  numArray,
  resourceTuples,
  stealResourceTuples,
  contributionTuples,
} from "../../src/abi/domain-overlay";

// Load real manifest from repo root
const manifestPath = resolve(__dirname, "../manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

// ── Overlay key validation ───────────────────────────────────────────────────

describe("overlay keys match manifest", () => {
  const allContracts = extractAllFromManifest(manifest);
  const allOverlayKeys = new Set<string>();
  for (const contract of allContracts) {
    for (const ep of getGameEntrypoints(contract)) {
      allOverlayKeys.add(`${contract.suffix}::${ep.name}`);
    }
  }

  it("every ETERNUM_OVERLAYS key maps to a real contract::entrypoint", () => {
    const invalid: string[] = [];
    for (const key of Object.keys(ETERNUM_OVERLAYS)) {
      if (!allOverlayKeys.has(key)) {
        invalid.push(key);
      }
    }
    if (invalid.length > 0) {
      console.log("\nInvalid overlay keys (not in manifest):", invalid);
    }
    expect(invalid).toEqual([]);
  });

  it("overlay param overrides match actual ABI param names", () => {
    const mismatches: string[] = [];
    for (const contract of allContracts) {
      for (const ep of getGameEntrypoints(contract)) {
        const key = `${contract.suffix}::${ep.name}`;
        const overlay = ETERNUM_OVERLAYS[key];
        if (!overlay?.paramOverrides) continue;
        const abiParamNames = new Set(ep.params.map((p) => p.name));
        for (const overrideKey of Object.keys(overlay.paramOverrides)) {
          if (!abiParamNames.has(overrideKey)) {
            mismatches.push(`${key}: param "${overrideKey}" not in ABI (has: ${[...abiParamNames].join(", ")})`);
          }
        }
      }
    }
    if (mismatches.length > 0) {
      console.log("\nParam override mismatches:", mismatches);
    }
    expect(mismatches).toEqual([]);
  });
});

// ── Integration with generateActions ─────────────────────────────────────────

describe("overlays integrate with generateActions", () => {
  const hiddenOverlays = createHiddenOverlays(manifest);
  const allOverlays = { ...ETERNUM_OVERLAYS, ...hiddenOverlays };
  const { definitions, routes } = generateActions(manifest, { overlays: allOverlays });

  it("generates renamed action types", () => {
    const types = new Set(definitions.map((d) => d.type));
    // Key renames from the old action-registry
    expect(types.has("send_resources")).toBe(true);
    expect(types.has("pickup_resources")).toBe(true);
    expect(types.has("claim_arrivals")).toBe(true);
    expect(types.has("create_explorer")).toBe(true);
    expect(types.has("add_to_explorer")).toBe(true);
    expect(types.has("delete_explorer")).toBe(true);
    expect(types.has("add_guard")).toBe(true);
    expect(types.has("delete_guard")).toBe(true);
    expect(types.has("move_explorer")).toBe(true);
    expect(types.has("swap_explorer_to_explorer")).toBe(true);
    expect(types.has("swap_explorer_to_guard")).toBe(true);
    expect(types.has("swap_guard_to_explorer")).toBe(true);
    expect(types.has("attack_explorer")).toBe(true);
    expect(types.has("attack_guard")).toBe(true);
    expect(types.has("guard_attack_explorer")).toBe(true);
    expect(types.has("raid")).toBe(true);
    expect(types.has("pause_production")).toBe(true);
    expect(types.has("resume_production")).toBe(true);
    expect(types.has("buy_resources")).toBe(true);
    expect(types.has("sell_resources")).toBe(true);
    expect(types.has("add_liquidity")).toBe(true);
    expect(types.has("remove_liquidity")).toBe(true);
    expect(types.has("upgrade_realm")).toBe(true);
    expect(types.has("contribute_hyperstructure")).toBe(true);
  });

  it("registers trade aliases", () => {
    expect(routes.has("create_trade")).toBe(true);
    expect(routes.has("accept_trade")).toBe(true);
    expect(routes.has("cancel_trade")).toBe(true);
    expect(routes.has("travel_explorer")).toBe(true);
  });

  it("hides admin/config entrypoints", () => {
    const types = new Set(definitions.map((d) => d.type));
    // Config methods should be hidden
    expect(types.has("set_world_config")).toBe(false);
    expect(types.has("set_troop_config")).toBe(false);
    expect(types.has("set_bank_config")).toBe(false);
    // Dev methods should be hidden
    expect(types.has("mint")).toBe(false);
    // Bank creation should be hidden
    expect(types.has("create_banks")).toBe(false);
  });

  it("enriches descriptions for overlayed actions", () => {
    const sendResources = definitions.find((d) => d.type === "send_resources");
    expect(sendResources).toBeDefined();
    expect(sendResources!.description).toBe("Send resources from one structure to another");
    // Not the default ABI signature
    expect(sendResources!.description).not.toContain("(");
  });

  it("enriches param descriptions", () => {
    const sendResources = definitions.find((d) => d.type === "send_resources");
    expect(sendResources).toBeDefined();
    const senderParam = sendResources!.params.find((p) => p.name === "sender_structure_id");
    expect(senderParam?.description).toBe("Structure ID of the sender");
  });

  it("has descriptions for building actions with building guide", () => {
    const createBuilding = definitions.find((d) => d.type === "create_building");
    expect(createBuilding).toBeDefined();
    expect(createBuilding!.description).toContain("BUILDING GUIDE");
    expect(createBuilding!.description).toContain("Ring 1");
  });

  it("coverage: all old action-registry types are present", () => {
    const OLD_ACTION_TYPES = [
      "send_resources",
      "pickup_resources",
      "claim_arrivals",
      "create_explorer",
      "add_to_explorer",
      "delete_explorer",
      "add_guard",
      "delete_guard",
      "move_explorer",
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
    ];

    const allTypes = new Set([...definitions.map((d) => d.type), ...routes.keys()]);

    const missing: string[] = [];
    for (const actionType of OLD_ACTION_TYPES) {
      if (!allTypes.has(actionType)) {
        missing.push(actionType);
      }
    }
    if (missing.length > 0) {
      console.log("\nMissing old action types:", missing);
    }
    expect(missing).toEqual([]);
  });
});

// ── createHiddenOverlays ─────────────────────────────────────────────────────

describe("createHiddenOverlays", () => {
  it("generates hidden entries for all config_systems entrypoints", () => {
    const hidden = createHiddenOverlays(manifest, ["config_systems"]);
    const keys = Object.keys(hidden);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      expect(key).toMatch(/^config_systems::/);
      expect(hidden[key].hidden).toBe(true);
    }
  });

  it("uses HIDDEN_SUFFIXES by default", () => {
    const hidden = createHiddenOverlays(manifest);
    const prefixes = new Set(Object.keys(hidden).map((k) => k.split("::")[0]));
    for (const suffix of HIDDEN_SUFFIXES) {
      expect(prefixes.has(suffix)).toBe(true);
    }
  });
});

// ── Param transform helpers ──────────────────────────────────────────────────

describe("num", () => {
  it("passes through numbers", () => {
    expect(num(42)).toBe(42);
  });

  it("parses string numbers", () => {
    expect(num("123")).toBe(123);
  });

  it("handles K/M/B/T suffixes", () => {
    expect(num("1.5K")).toBe(1500);
    expect(num("2M")).toBe(2_000_000);
    expect(num("1B")).toBe(1_000_000_000);
  });

  it("handles commas", () => {
    expect(num("1,000")).toBe(1000);
    expect(num("1,234,567")).toBe(1234567);
  });
});

describe("precisionAmount", () => {
  it("multiplies by RESOURCE_PRECISION", () => {
    expect(precisionAmount(1)).toBe(RESOURCE_PRECISION);
    expect(precisionAmount(100)).toBe(100 * RESOURCE_PRECISION);
  });

  it("floors fractional results", () => {
    expect(precisionAmount(0.5)).toBe(Math.floor(0.5 * RESOURCE_PRECISION));
  });

  it("handles string input", () => {
    expect(precisionAmount("10")).toBe(10 * RESOURCE_PRECISION);
  });
});

describe("bool", () => {
  it("handles boolean values", () => {
    expect(bool(true)).toBe(true);
    expect(bool(false)).toBe(false);
  });

  it("handles string values", () => {
    expect(bool("true")).toBe(true);
    expect(bool("false")).toBe(false);
    expect(bool("1")).toBe(true);
    expect(bool("0")).toBe(false);
  });
});

describe("numArray", () => {
  it("converts array elements to numbers", () => {
    expect(numArray([1, "2", 3])).toEqual([1, 2, 3]);
  });

  it("returns empty for non-arrays", () => {
    expect(numArray("not an array")).toEqual([]);
    expect(numArray(null)).toEqual([]);
  });
});

describe("resourceTuples", () => {
  it("converts resource objects to tuples with precision", () => {
    const result = resourceTuples([
      { resourceType: 1, amount: 100 },
      { resourceType: 2, amount: 50 },
    ]);
    expect(result).toEqual([
      [1, 100 * RESOURCE_PRECISION],
      [2, 50 * RESOURCE_PRECISION],
    ]);
  });

  it("handles snake_case keys", () => {
    const result = resourceTuples([{ resource_type: 3, amount: 10 }]);
    expect(result).toEqual([[3, 10 * RESOURCE_PRECISION]]);
  });

  it("handles resourceId key", () => {
    const result = resourceTuples([{ resourceId: 5, amount: 1 }]);
    expect(result).toEqual([[5, 1 * RESOURCE_PRECISION]]);
  });

  it("returns empty for non-arrays", () => {
    expect(resourceTuples(null)).toEqual([]);
    expect(resourceTuples("bad")).toEqual([]);
  });
});

describe("stealResourceTuples", () => {
  it("converts steal resource objects to tuples with precision", () => {
    const result = stealResourceTuples([{ resourceId: 1, amount: 50 }]);
    expect(result).toEqual([[1, 50 * RESOURCE_PRECISION]]);
  });

  it("handles resourceType as fallback key", () => {
    const result = stealResourceTuples([{ resourceType: 3, amount: 10 }]);
    expect(result).toEqual([[3, 10 * RESOURCE_PRECISION]]);
  });
});

describe("contributionTuples", () => {
  it("handles object array format", () => {
    const result = contributionTuples([
      { resourceType: 1, amount: 100 },
      { resourceType: 37, amount: 500 },
    ]);
    expect(result).toEqual([
      [1, 100 * RESOURCE_PRECISION],
      [37, 500 * RESOURCE_PRECISION],
    ]);
  });

  it("handles flat array format [type, amount, type, amount, ...]", () => {
    const result = contributionTuples([1, 100, 37, 500]);
    expect(result).toEqual([
      [1, 100 * RESOURCE_PRECISION],
      [37, 500 * RESOURCE_PRECISION],
    ]);
  });

  it("returns empty for non-arrays", () => {
    expect(contributionTuples(null)).toEqual([]);
  });
});

// ── Pre-flight checks ────────────────────────────────────────────────────────

describe("pre-flight: send_resources", () => {
  const overlay = ETERNUM_OVERLAYS["resource_systems::send"];
  const preflight = overlay.preflight!;

  it("passes when no cached state", () => {
    expect(preflight({ sender_structure_id: 1, resources: [] })).toBeNull();
  });

  it("passes when sender has sufficient balance", () => {
    const state = {
      entities: [
        {
          entityId: 1,
          type: "structure",
          resources: new Map([["Stone", 100]]),
        },
      ],
    };
    const params = {
      sender_structure_id: 1,
      resources: [{ resourceType: 1, amount: 50 }],
    };
    expect(preflight(params, state)).toBeNull();
  });

  it("fails when sender has insufficient balance", () => {
    const state = {
      entities: [
        {
          entityId: 1,
          type: "structure",
          resources: new Map([["Stone", 10]]),
        },
      ],
    };
    const params = {
      sender_structure_id: 1,
      resources: [{ resourceType: 1, amount: 50 }],
    };
    const result = preflight(params, state);
    expect(result).toContain("Insufficient balance");
    expect(result).toContain("Stone");
  });
});

describe("pre-flight: create_explorer", () => {
  const overlay = ETERNUM_OVERLAYS["troop_management_systems::explorer_create"];
  const preflight = overlay.preflight!;

  it("passes when no cached state", () => {
    expect(preflight({ for_structure_id: 1 })).toBeNull();
  });

  it("passes when army limit not reached", () => {
    const state = {
      entities: [
        {
          entityId: 1,
          type: "structure",
          isOwned: true,
          armies: { current: 2, max: 5 },
        },
      ],
    };
    expect(preflight({ for_structure_id: 1 }, state)).toBeNull();
  });

  it("fails when army limit reached", () => {
    const state = {
      entities: [
        {
          entityId: 1,
          type: "structure",
          isOwned: true,
          armies: { current: 5, max: 5 },
        },
      ],
    };
    const result = preflight({ for_structure_id: 1 }, state);
    expect(result).toContain("5/5 armies");
  });
});

describe("pre-flight: explorer_move", () => {
  const overlay = ETERNUM_OVERLAYS["troop_movement_systems::explorer_move"];
  const preflight = overlay.preflight!;

  it("passes when not exploring", () => {
    expect(preflight({ explore: false, explorer_id: 1, directions: [0] })).toBeNull();
  });

  it("passes when no cached state", () => {
    expect(preflight({ explore: true, explorer_id: 1, directions: [0] })).toBeNull();
  });

  it("passes when explorer has enough stamina", () => {
    const state = {
      entities: [{ entityId: 1, type: "army", isOwned: true, stamina: 60 }],
    };
    expect(preflight({ explore: true, explorer_id: 1, directions: [0] }, state)).toBeNull();
  });

  it("fails when explorer has insufficient stamina", () => {
    const state = {
      entities: [{ entityId: 1, type: "army", isOwned: true, stamina: 10 }],
    };
    const result = preflight({ explore: true, explorer_id: 1, directions: [0] }, state);
    expect(result).toContain("stamina");
    expect(result).toContain("10");
  });
});
