import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { campBeside, reloadSiteFacts, SITE, SITE_TILE } from "./site-fixture";
import { readClearedSite, SiteReceipt } from "./site-receipt";

const clear = (store: NativeFactStore, amount: bigint | null, resourceType = 23) => {
  const site = store.require("ExpeditionSite", { game_id: 1, entity_id: SITE });
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: {
        ...site,
        clear: {
          explorer_id: 201n,
          home_id: 7n,
          reward: amount === null ? null : { resource_type: resourceType, amount },
        },
      },
    },
    { model: "TileOccupancy", key: "0x90", value: null },
    { model: "Structure", key: "0x71", value: null },
    { model: "Guard", key: "0x73", value: null },
  ]);
};

it.each([0n, 1n, 10_000_000_000n, 550_000_000_000n])(
  "shows the credited %s, rounded as every reward reads, including capped and empty credits",
  (amount) => {
    const { store } = campBeside();
    clear(store, amount);
    const receipt = readClearedSite(store, 1, SITE_TILE)!;
    const markup = renderToStaticMarkup(<SiteReceipt selected={receipt} />);
    expect(markup).toContain(`<strong>${amount === 1n ? "&lt;1" : amount / 1_000_000_000n}</strong>`);
    expect(markup).toContain("Labor");
    expect(markup).toContain("82");
    expect(receipt.site.clear?.reward?.amount).toBe(amount);
  },
);

it("shows only XP when a beast clear has no credited labor, and no receipt for a standing site", () => {
  const { store } = campBeside("Beasts");
  expect(readClearedSite(store, 1, SITE_TILE)).toBeNull();
  clear(store, null);
  const markup = renderToStaticMarkup(<SiteReceipt selected={readClearedSite(store, 1, SITE_TILE)!} />);
  expect(markup).toContain("79");
  expect(markup).toContain("XP");
  expect(markup).not.toContain("Labor");
});

it.each([
  ["Rift", 38, "Essence"],
  ["Ruin", 37, "LORDS"],
] as const)("reads the %s credit from the receipt", (kind, resourceType, name) => {
  const { store } = campBeside(kind);
  clear(store, 750_000_000n, resourceType);
  const selected = readClearedSite(store, 1, SITE_TILE)!;
  expect(selected.site.clear).toEqual({
    explorer_id: 201n,
    home_id: 7n,
    reward: { resource_type: resourceType, amount: 750_000_000n },
  });
  const markup = renderToStaticMarkup(<SiteReceipt selected={selected} />);
  expect(markup).toContain("<strong>&lt;1</strong>");
  expect(markup).toContain(name);
});

describe("the marker and receipt survive occupancy and snapshots", () => {
  it("replaces the camp atomically, stays beside an army, and rebuilds from facts alone", () => {
    const { store } = campBeside();
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x90",
        value: { game_id: 1, ...SITE_TILE, entity_id: SITE, category: TileOccupier.Camp, is_structure: true },
      },
    ]);
    const projection = new WorldSpatialProjection({ store });
    projection.start();
    expect(projection.getStructure(SITE)?.clearedSite).toBeUndefined();
    clear(store, 10_000_000_000n);
    expect(projection.getStructure(SITE)?.clearedSite).toBe(true);
    expect(store.entityOccupancy(1, SITE)).toBeUndefined();
    expect(store.get("Structure", { game_id: 1, entity_id: SITE })).toBeUndefined();
    expect(store.get("Guard", { game_id: 1, structure_id: SITE, slot: 0 })).toBeUndefined();
    store.applyFacts([
      { model: "TileOccupancy", key: "0x75", value: null },
      {
        model: "TileOccupancy",
        key: "0x91",
        value: {
          game_id: 1,
          ...SITE_TILE,
          entity_id: 201,
          category: TileOccupier.ExplorerKnightT1,
          is_structure: false,
        },
      },
    ]);
    expect(projection.getArmiesAtHex(SITE_TILE).map((army) => army.entityId)).toEqual([201]);
    expect(projection.getStructuresAtHex(SITE_TILE).map((site) => site.entityId)).toEqual([SITE]);
    const receipt = readClearedSite(store, 1, SITE_TILE)!;
    expect(receipt.site.clear?.reward?.amount).toBe(10_000_000_000n);
    const restored = reloadSiteFacts(store);
    const reloaded = new WorldSpatialProjection({ store: restored });
    reloaded.start();
    expect(reloaded.getStructure(SITE)?.clearedSite).toBe(true);
    expect(reloaded.getArmiesAtHex(SITE_TILE).map((army) => army.entityId)).toEqual([201]);
    expect(readClearedSite(restored, 1, SITE_TILE)).toEqual(receipt);
    reloaded.dispose();
    store.applyFacts([
      { model: "TileOccupancy", key: "0x91", value: null },
      {
        model: "TileOccupancy",
        key: "0x75",
        value: {
          game_id: 1,
          alt: false,
          col: 41,
          row: 12,
          entity_id: 201,
          category: TileOccupier.ExplorerKnightT1,
          is_structure: false,
        },
      },
    ]);
    expect(projection.getArmiesAtHex(SITE_TILE)).toEqual([]);
    expect(projection.getStructure(SITE)?.clearedSite).toBe(true);
    store.applyFacts([{ model: "ExpeditionSite", key: "0x72", value: null }]);
    expect(projection.getStructure(SITE)).toBeUndefined();
    expect(readClearedSite(store, 1, SITE_TILE)).toBeNull();
    projection.dispose();
  });
});
