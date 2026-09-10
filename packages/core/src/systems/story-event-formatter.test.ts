import { createWorld, defineComponent, setComponent, Type, type Component, type Entity } from "@dojoengine/recs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { ClientComponents } from "@bibliothecadao/types";
// The package index first, so the config singleton the utils read through it is evaluated before any story runs.
import { configManager } from "..";
import { buildStoryEventPresentation } from "./story-event-formatter";

// Structure names check the player's local renames first; core tests have no DOM.
vi.stubGlobal("localStorage", { getItem: () => null });
beforeEach(() => {
  // The formatter reads the map centre and the blitz flag off the config singleton, which no test initialises.
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483647);
  vi.spyOn(configManager, "getBlitzConfig").mockReturnValue(undefined as never);
});

type Event = Parameters<typeof buildStoryEventPresentation>[0];

/** A fake component set: only the rows a story reads, keyed the way the game keys them. */
const buildComponents = () => {
  const world = createWorld();
  const Structure = defineComponent(world, {
    entity_id: Type.Number,
    owner: Type.BigInt,
    base: { category: Type.Number, level: Type.Number, coord_x: Type.Number, coord_y: Type.Number },
    metadata: { realm_id: Type.Number, has_wonder: Type.Boolean, village_realm: Type.Number },
  });
  const ExplorerTroops = defineComponent(world, {
    explorer_id: Type.Number,
    owner: Type.Number,
    troops: { category: Type.String, tier: Type.String },
  });
  const AddressName = defineComponent(world, { name: Type.BigInt });
  const key = (id: number): Entity => getEntityIdFromKeys([BigInt(id)]);
  const setStructure = (id: number, realmId: number, level: number) =>
    setComponent(Structure as Component, key(id), {
      entity_id: id,
      owner: 0x123n,
      base: { category: 1, level, coord_x: 2147483650, coord_y: 2147483660 },
      metadata: { realm_id: realmId, has_wonder: false, village_realm: 0 },
    });
  const setExplorer = (id: number, owner: number, tier: string) =>
    setComponent(ExplorerTroops as Component, key(id), {
      explorer_id: id,
      owner,
      troops: { category: "Knight", tier },
    });
  return {
    components: { Structure, ExplorerTroops, AddressName } as unknown as ClientComponents,
    setStructure,
    setExplorer,
  };
};

const story = (storyType: string, storyPayload: Record<string, unknown>, entityId: number | null = null): Event =>
  ({ storyType, storyPayload, entityId, ownerAddress: "0x123" }) as Event;

it("uses the winning owner structure from Herald even when survivors format with separators", () => {
  const presentation = buildStoryEventPresentation(
    story("BattleStory", {
      attacker_id: "0x25848",
      defender_id: "0x253a4",
      winner_id: "0x2581f",
      attacker_owner_id: "0x2581f",
      defender_owner_id: "0x25381",
      attacker_owner_address: "0x123",
      defender_owner_address: "0x456",
      attacker_troops_before: "0x3289eee6a00",
      attacker_troops_lost: "0x649534e00",
      defender_troops_before: "0x174876e800",
      defender_troops_lost: "0x174876e800",
    }),
  );
  expect(presentation.description).toContain("Winner: Attacker");
  expect(presentation.description).not.toContain("Winner: Draw");
});

it("names an explorer by its home realm and tier, and its origin by the structure", () => {
  const { components, setStructure, setExplorer } = buildComponents();
  setStructure(164316, 1, 2);
  setExplorer(164347, 164316, "T2");
  const presentation = buildStoryEventPresentation(
    story("ExplorerMoveStory", { explorer_id: 164347, explorer_structure_id: 164316, explore: true }, 164316),
    components,
  );
  const realmName = presentation.title.replace(" T2 army moved", "");
  expect(realmName).not.toMatch(/^\s*$|Explorer|\d{5}/);
  expect(presentation.title).toBe(`${realmName} T2 army moved`);
  expect(presentation.description).toContain(`Origin: ${realmName} · Level 2`);
  expect(presentation.description).not.toMatch(/Entity #|Explorer \d/);
});

it("falls back to the home structure from the payload when the explorer row is gone, never an id", () => {
  const { components, setStructure } = buildComponents();
  setStructure(164316, 1, 1);
  const retired = buildStoryEventPresentation(story("ExplorerDeleteStory", { explorer_id: 164347 }), components);
  expect(retired.description).toBe("Army disbanded.");
  const moved = buildStoryEventPresentation(
    story("ExplorerMoveStory", { explorer_id: 164347, explorer_structure_id: 164316 }),
    components,
  );
  expect(moved.title).toMatch(/^\S.* army moved$/);
  expect(moved.title).not.toMatch(/\d{5}/);
});

it("describes battle sides and transfer routes through the same resolvers", () => {
  const { components, setStructure, setExplorer } = buildComponents();
  setStructure(10, 3, 1);
  setStructure(11, 4, 1);
  setExplorer(20, 10, "T1");
  const battle = buildStoryEventPresentation(
    story("BattleStory", {
      attacker_id: 20,
      defender_id: 11,
      winner_id: 10,
      attacker_owner_id: 10,
      defender_owner_id: 11,
      attacker_troops_before: 100,
      attacker_troops_lost: 10,
      defender_troops_before: 100,
      defender_troops_lost: 100,
    }),
    components,
  );
  expect(battle.description).toMatch(/Attacker \[[^\]]+\]:  \S.* T1 army/);
  expect(battle.description).not.toMatch(/Army \d|Entity #/);
  const transfer = buildStoryEventPresentation(
    story("ResourceTransferStory", { from_entity_id: 10, to_entity_id: 20, resources: [] }),
    components,
  );
  expect(transfer.description).toMatch(/^Route: \S.* → \S.* T1 army/);
});

it("keeps an unknown story to its owner and subject without ids or hashes", () => {
  const { components, setStructure } = buildComponents();
  setStructure(7, 5, 1);
  const presentation = buildStoryEventPresentation(
    { ...story("MysteryStory", {}, 7), txHash: "0xdeadbeef" } as Event,
    components,
  );
  expect(presentation.title).toBe("MysteryStory event");
  expect(presentation.description).not.toMatch(/Entity #|Tx:|0xdeadbeef/);
  expect(presentation.description).toMatch(/^Owner: 0x/);
});

describe("owner naming", () => {
  it("names owners through the injected resolver, reads the zero address as Neutral, and shortens the rest", () => {
    const resolve = (address: string) => (address === "0x70bf" ? "Lord KB" : null);
    const presentation = buildStoryEventPresentation(
      {
        ownerAddress: "0x70bf",
        ownerName: null,
        entityId: 1,
        txHash: "0x1",
        timestamp: 0,
        storyType: "BattleStory",
        storyPayload: { attacker_owner_address: "0x70bf", defender_owner_address: "0x0", winner_id: 1, attacker_id: 1 },
        rawStory: {},
      },
      undefined,
      resolve,
    );
    expect(presentation.owner).toBe("Lord KB");
    expect(presentation.description).toContain("Attacker [Lord KB]");
    expect(presentation.description).toContain("Defender [Neutral]");
    const unnamed = buildStoryEventPresentation(
      {
        ownerAddress: "0x1234567890abcdef",
        ownerName: null,
        entityId: 1,
        txHash: "0x1",
        timestamp: 0,
        storyType: "Unknown",
        storyPayload: {},
        rawStory: {},
      },
      undefined,
      resolve,
    );
    expect(unnamed.owner).toBe("0x1234…cdef");
  });
});
