// @vitest-environment jsdom
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { siteName, StructureType, TileOccupier } from "@bibliothecadao/types";
import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import rowFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import type { StructurePlate } from "../map-plates/map-plate-model";
import { plateRows } from "../map-plates/map-plate-rows";
import { CameraView } from "../scenes/camera-view";
import { StructureManager } from "./structure-manager";
import { campBeside, SITE, SITE_TILE } from "@/ui/features/frontier/sites/site-fixture";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

const REALM = 7;

afterEach(() => {
  setBlockTimestampSource(null);
  useChainTimeStore.setState({ anchorTimestampMs: null, anchorPerfMs: null, nowMs: null });
});

/** The chain's time at a second, as a confirmed head binds it: the stamina clock and the app's clock agree. */
const chainAt = (seconds: number) => {
  setBlockTimestampSource(() => seconds);
  useChainTimeStore.setState({
    anchorTimestampMs: seconds * 1000,
    anchorPerfMs: performance.now(),
    nowMs: seconds * 1000,
  });
};

/**
 * The fixture realm with one guard slot, as the chain sends it (its bar still wrapped, `{ Inline }`), in a Blitz game
 * (preset 3: knights capped at 120, a tier adds 20, 20 stamina a 60 s tick) or a Frontier game (`frontierDay`: knights
 * capped at 150, no tier bonus).
 */
const realmWithGuard = (
  game: "blitz" | "frontier",
  tier: "T2" | "T3",
  stamina: { amount: number; settledAt: number },
) => {
  const { store, row } = frontierDay();
  store.applyFacts([
    ...(game === "blitz"
      ? [{ model: "SliceRules", key: "0x100", value: { ...preset.rules, game_id: 1, day_unit_seconds: 0 } }]
      : []),
    { model: "Structure", key: "0x7", value: { ...row, base: { ...row.base, troop_max_guard_count: 1 } } },
    {
      model: "Guard",
      key: "0x9a0",
      value: {
        game_id: 1,
        structure_id: REALM,
        slot: 0,
        troops: {
          ...rowFixture.expected.value.troops,
          tier,
          count: String(300n * 1_000_000_000n),
          stamina: { Inline: { amount: String(stamina.amount), settled_at: String(stamina.settledAt), remainder: 0 } },
        },
        destroyed_tick: 0,
      },
    },
  ] as never);
  return store;
};

/**
 * The structure manager with the realm labelled on the map, as a visible pass leaves it: its facts cached with its
 * guard's count (and no stamina), its plate drawn. Only what the plate refresh reads is set.
 */
const managerOver = (store: ReturnType<typeof realmWithGuard>, tier: number) => {
  const plates: StructurePlate[] = [];
  const manager = Object.assign(Object.create(StructureManager.prototype), {
    store,
    isDestroyed: false,
    currentCameraView: CameraView.Medium,
    compactLabelIds: new Set([REALM]),
    metrics: { structureInfoCacheHits: 0, structureInfoCacheMisses: 0, compactLabelsShown: 1 },
    worldSpatialProjection: { getStructure: () => ({ entityId: REALM, reserved: false }) },
    structureInfoCache: new Map([
      [
        REALM,
        {
          entityId: REALM,
          structureName: "Niziz",
          structureType: StructureType.Realm,
          mineKind: undefined,
          isMine: false,
          isAlly: false,
          owner: { address: 9n, ownerName: "Tamsin", guildName: "" },
          guardArmies: [{ slot: 0, category: "Knight", tier, count: 300 }],
          incomingTroopArrivals: [],
        },
      ],
    ]),
    resolveStructureCompactLabelPosition: () => new Vector3(),
    plates: { setLabel: vi.fn(({ plate }: { plate: StructurePlate }) => plates.push(plate)), removeLabel: vi.fn() },
  }) as { refreshLivePlates(): void };
  /** The guard's stamina on the plate the refresh last said. */
  const said = () => {
    manager.refreshLivePlates();
    return plates.at(-1)!.guards![0].stamina;
  };
  return { said, plates };
};

describe("a structure's guard stamina on its map plate, as the chain's time runs on", () => {
  it("shows a Blitz guard's balance and its regeneration, its cap with its tier's bonus", () => {
    const store = realmWithGuard("blitz", "T2", { amount: 60, settledAt: 100 });
    const { said } = managerOver(store, 2);
    chainAt(100);
    expect(said()).toEqual({ current: 60, max: 140 });
    // A minute later, one tick: 20 more, with no guard row changed and the cached facts untouched.
    chainAt(160);
    expect(said()).toEqual({ current: 80, max: 140 });
    chainAt(400);
    expect(said()).toEqual({ current: 140, max: 140 });
  });

  it("caps a Frontier guard at its game's maximum, with no tier bonus, however high its tier", () => {
    const store = realmWithGuard("frontier", "T3", { amount: 60, settledAt: 290 });
    const { said } = managerOver(store, 3);
    chainAt(350);
    expect(said()).toEqual({ current: 80, max: 150 });
    chainAt(1_000);
    expect(said()).toEqual({ current: 150, max: 150 });
  });
});

it("presents a cleared standard from its receipt after the structure and guard are gone", () => {
  const { store, site } = campBeside();
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward: null } },
    },
    { model: "Structure", key: "0x71", value: null },
    { model: "Guard", key: "0x73", value: null },
  ]);
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  expect(projection.getStructure(SITE)).toMatchObject({
    clearedSite: true,
    hexCoords: SITE_TILE,
    occupierType: TileOccupier.Camp,
  });
  const manager = Object.assign(Object.create(StructureManager.prototype), {
    store,
    worldSpatialProjection: projection,
    structureInfoCache: new Map(),
    unpresentableStructures: new Set(),
    metrics: { structureInfoCacheHits: 0, structureInfoCacheMisses: 0 },
    updateTimedLabelTracking: vi.fn(),
  }) as StructureManager;
  expect(manager.getStructureMarkerFacts(SITE)).toEqual({
    isAlly: false,
    isMine: false,
    ownerAddress: 0n,
    structureType: StructureType.Camp,
  });
  projection.dispose();
});

it("names a cleared site on its plate by the name every reader gives it, held by nobody", () => {
  const { store, site } = campBeside();
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward: null } },
    },
    { model: "Structure", key: "0x71", value: null },
    { model: "Guard", key: "0x73", value: null },
  ]);
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  const plates: StructurePlate[] = [];
  const manager = Object.assign(Object.create(StructureManager.prototype), {
    store,
    worldSpatialProjection: projection,
    structureInfoCache: new Map(),
    unpresentableStructures: new Set(),
    metrics: { structureInfoCacheHits: 0, structureInfoCacheMisses: 0, compactLabelsShown: 0 },
    updateTimedLabelTracking: vi.fn(),
    compactLabelIds: new Set([SITE]),
    currentCameraView: CameraView.Medium,
    resolveStructureCompactLabelPosition: () => new Vector3(),
    requestVisibleStructuresRefreshForEntities: vi.fn(),
    plates: { setLabel: vi.fn(({ plate }: { plate: StructurePlate }) => plates.push(plate)), removeLabel: vi.fn() },
  }) as { refreshStructurePresentation(entityId: number): void };
  chainAt(400);
  manager.refreshStructurePresentation(SITE);
  const said = plateRows(plates.at(-1)!).map((row) =>
    row.flatMap((segment) => ("text" in segment ? [segment.text] : [])),
  );
  expect(said).toEqual([[siteName(SITE), "Troll · Cleared"]]);
  projection.dispose();
});
