// @vitest-environment jsdom
// @vitest-environment jsdom
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import rowFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import release from "../../../../../contracts/l3/world-native/schema/release-definition.json";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import type { StructurePlate } from "../map-plates/map-plate-model";
import { CameraView } from "../scenes/camera-view";
import { StructureManager } from "./structure-manager";
import { campBeside, SITE, SITE_TILE } from "@/ui/features/frontier/sites/site-fixture";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { SiteKind } from "@bibliothecadao/eternum";

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

const realmWithGuard = (tier: "T2" | "T3", stamina: { amount: number; settledAt: number }) => {
  const { store, row } = frontierDay();
  store.applyFacts([
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
          level: 0,
          hasWonder: false,
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
  const { stamina_gain_per_tick: gain, stamina_explore_stamina_cost: perExplore } =
    release.definition.rules.troop_stamina_config;
  const tick = Number(release.definition.rules.tick_config.armies_tick_in_seconds);

  it("regenerates a Frontier guard each armies tick and caps it at its game's maximum, with no tier bonus", () => {
    const store = realmWithGuard("T3", { amount: 60, settledAt: 2 * tick });
    const { said } = managerOver(store, 3);
    chainAt(3 * tick - 1);
    expect(said()).toEqual({ current: 60, max: 150, perExplore });
    chainAt(3 * tick);
    expect(said()).toEqual({ current: 60 + gain, max: 150, perExplore });
    chainAt((2 + 150) * tick);
    expect(said()).toEqual({ current: 150, max: 150, perExplore });
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
    hasWonder: false,
  });
  projection.dispose();
});

// Owner, 28 October 2026: "we dont need to put the flag labels on the map it overcrowds it a bit and there's already a
// flag on the tile".
it("sets no plate on a cleared site, and takes away the one it had: the standard on its tile says it", () => {
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
  const plates = { setLabel: vi.fn(), removeLabel: vi.fn() };
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
    plates,
  }) as { refreshStructurePresentation(entityId: number): void; compactLabelIds: Set<number> };
  chainAt(400);
  manager.refreshStructurePresentation(SITE);
  expect(plates.setLabel).not.toHaveBeenCalled();
  expect(plates.removeLabel).toHaveBeenCalledWith(SITE);
  expect(manager.compactLabelIds.has(SITE)).toBe(false);
  projection.dispose();
});

// Owner, 30 October 2026: "we can drop the stamina bar for enemies in frontier". A site's guards never move or explore.
describe("a Frontier site's guards on its map plate", () => {
  const SITE_TYPES = {
    Ruin: StructureType.Ruin,
    Camp: StructureType.Camp,
    Beasts: StructureType.Beasts,
    Rift: StructureType.Rift,
  } satisfies Record<SiteKind, StructureType>;

  /** The site's guard on the plate the manager's refresh says, with the site's real guard row in the store. */
  const guardOnPlate = (kind: SiteKind, siteKind: SiteKind | undefined) => {
    const { store } = campBeside(kind);
    const plates: StructurePlate[] = [];
    const manager = Object.assign(Object.create(StructureManager.prototype), {
      store,
      isDestroyed: false,
      currentCameraView: CameraView.Medium,
      compactLabelIds: new Set([SITE]),
      metrics: { structureInfoCacheHits: 0, structureInfoCacheMisses: 0, compactLabelsShown: 1 },
      worldSpatialProjection: { getStructure: () => ({ entityId: SITE, reserved: false }) },
      structureInfoCache: new Map([
        [
          SITE,
          {
            entityId: SITE,
            structureName: "Titangate",
            structureType: SITE_TYPES[kind],
            siteKind,
            isMine: false,
            isAlly: false,
            owner: { address: 0n, ownerName: "", guildName: "" },
            guardArmies: [{ slot: 0, category: "Knight", tier: 1, count: 1_100 }],
            incomingTroopArrivals: [],
          },
        ],
      ]),
      resolveStructureCompactLabelPosition: () => new Vector3(),
      plates: { setLabel: vi.fn(({ plate }: { plate: StructurePlate }) => plates.push(plate)), removeLabel: vi.fn() },
    }) as { refreshLivePlates(): void };
    chainAt(400);
    manager.refreshLivePlates();
    return plates.at(-1)!.guards![0];
  };

  it.each(Object.keys(SITE_TYPES) as SiteKind[])(
    "tells no stamina on a standing %s's guard, only its count",
    (kind) => {
      expect(guardOnPlate(kind, kind)).toEqual({
        type: kind === "Rift" ? "crossbowman" : "knight",
        tier: 1,
        count: kind === "Beasts" ? 1_000 : 1_100,
      });
    },
  );

  it("reads the same guard's stamina for a structure that is not a standing site", () => {
    expect(guardOnPlate("Camp", undefined).stamina).toMatchObject({
      current: 0,
      max: release.definition.rules.troop_stamina_config.stamina_knight_max,
    });
  });
});
