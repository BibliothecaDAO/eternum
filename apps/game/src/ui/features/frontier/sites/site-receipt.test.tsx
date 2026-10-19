import {
  nativeFactModels,
  type NativeModelName,
} from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier } from "@bibliothecadao/types";
import { campBeside, SITE, SITE_TILE } from "./site-fixture";
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
  ]);
};

it.each([0n, 1n, 10_000_000_000n, 550_000_000_000n])(
  "shows exactly the credited %s, including capped and empty credits",
  (amount) => {
    const { store } = campBeside();
    clear(store, amount);
    const receipt = readClearedSite(store, 1, SITE_TILE)!;
    const markup = renderToStaticMarkup(<SiteReceipt selected={receipt} />);
    expect(markup).toContain(`<strong>${amount === 1n ? "0.000000001" : amount / 1_000_000_000n}</strong>`);
    expect(markup).toContain("Labor");
    expect(markup).toContain("82");
    expect(receipt.site.clear?.reward?.amount).toBe(amount);
  },
);

it("shows only XP for stragglers, and no receipt for a standing site", () => {
  const { store } = campBeside("Stragglers");
  expect(readClearedSite(store, 1, SITE_TILE)).toBeNull();
  clear(store, null);
  const markup = renderToStaticMarkup(<SiteReceipt selected={readClearedSite(store, 1, SITE_TILE)!} />);
  expect(markup).toContain("82");
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
  expect(markup).toContain("<strong>0.75</strong>");
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
    const restored = new NativeFactStore();
    let wireKey = 1;
    const snapshot = (Object.keys(nativeFactModels) as NativeModelName[]).flatMap((model) =>
      [...store.rows(model)].map((value) => ({ model, key: `0x${(wireKey++).toString(16)}`, value })),
    );
    restored.applyFacts(
      JSON.parse(JSON.stringify(snapshot, (_, value) => (typeof value === "bigint" ? value.toString() : value))),
    );
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
    projection.dispose();
  });
});
