// @vitest-environment jsdom
// @vitest-environment jsdom
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { StructureType, TileOccupier, orderAspect } from "@bibliothecadao/types";
import { Matrix4, Object3D, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import rowFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import release from "../../../../../contracts/l3/world-native/schema/release-definition.json";
import { getGameModeConfig } from "@/config/game-modes";
import { GAME_FAMILIES } from "../../../../../config/source/common/native-preset-modes";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import type { StructurePlate } from "../map-plates/map-plate-model";
import { CameraView } from "../scenes/camera-view";
import {
  SITE_LANDMARK_MODEL_INDEX,
  SUPPLY_POST_MODEL_INDEX,
  SUPPLY_POST_STANDARD,
  frontierBeastModelIndex,
  frontierSiteComposition,
  ruinVariantModelIndex,
} from "../structures/frontier-beast";
import { ruinVariantForHex } from "../structures/ruin-kit";
import { SettlementModel } from "../structures/settlement-model";
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

it("presents a cleared camp's supply post, its clearing player's, from its occupier after the structure and guard are gone", () => {
  const { store, site } = campBeside();
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: { ...site, clear: { explorer_id: 201n, home_id: 7n, reward: null } },
    },
    { model: "Structure", key: "0x71", value: null },
    { model: "Guard", key: "0x73", value: null },
    {
      model: "TileOccupancy",
      key: "0x7710",
      value: { game_id: 1, ...SITE_TILE, entity_id: SITE, category: TileOccupier.SupplyPost, is_structure: true },
    },
  ] as never);
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  expect(projection.getStructure(SITE)).toMatchObject({
    clearedSite: true,
    hexCoords: SITE_TILE,
    occupierType: TileOccupier.SupplyPost,
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
    ownerAddress: 0x111n,
    structureType: StructureType.Camp,
    hasWonder: false,
  });
  projection.dispose();
});

describe("Frontier camp and supply post models", () => {
  const mode = getGameModeConfig(GAME_FAMILIES.frontier);

  const makeModel = (settlement = false) => {
    const matrices: Matrix4[] = [];
    return Object.assign(settlement ? Object.create(SettlementModel.prototype) : {}, {
      kind: "village",
      height: settlement ? 0.9 : 0.73,
      matrices,
      setMatrixAt: vi.fn((_index: number, matrix: Matrix4) => {
        matrices.push(matrix.clone());
      }),
      setCount: vi.fn(),
      setAspectAt: vi.fn(),
      setRelationshipAt: vi.fn(),
      setWonderEntityAt: vi.fn(),
    });
  };

  const placementOf = (matrix: Matrix4) => {
    const position = new Vector3().setFromMatrixPosition(matrix);
    const scale = new Vector3().setFromMatrixScale(matrix);
    return {
      x: Number(position.x.toFixed(4)),
      y: Number(position.y.toFixed(4)),
      z: Number(position.z.toFixed(4)),
      scale: Number(scale.x.toFixed(4)),
    };
  };

  const bindManager = (modelsByType: Map<StructureType, Map<number, ReturnType<typeof makeModel>>>) => {
    const dummy = new Object3D();
    const manager = Object.assign(Object.create(StructureManager.prototype), {
      mode,
      structureModelPaths: mode.assets.structureModelPaths,
      structureModels: modelsByType,
      structureInstanceBindings: new Map(),
      structureInstanceSlots: new Map(),
      structureInstanceFreeSlots: new Map(),
      structureModelDrawCounts: new Map(),
      dummy,
      scratchPosition: new Vector3(),
      resolveVisibleStructureRotationY: () => 0,
      syncVisibleStructurePresentation: vi.fn(),
      lightGroundAround: vi.fn(),
    }) as {
      dummy: Object3D;
      getStructureModelIndices(structure: unknown): number[];
      addVisibleStructureInstance(structure: unknown, retain: Set<number>, dirty: Set<unknown>): void;
    };
    return manager;
  };

  it("composes a guarded camp with both its camp model and its beast guard at the composed offset", () => {
    const campModel = makeModel();
    const trollModel = makeModel();
    const composition = frontierSiteComposition(StructureType.Camp);
    const manager = bindManager(
      new Map([
        [
          StructureType.Camp,
          new Map([
            [SITE_LANDMARK_MODEL_INDEX, campModel],
            [frontierBeastModelIndex("troll"), trollModel],
          ]),
        ],
      ]),
    );
    const structure = {
      entityId: SITE,
      structureName: "Galecrag",
      hexCoords: { col: 0, row: 0 },
      stage: 0,
      level: 0,
      isMine: false,
      isAlly: false,
      owner: { address: 0n, ownerName: "", guildName: "" },
      structureType: StructureType.Camp,
      hasWonder: false,
      frontierBeast: { beast: "troll" as const, name: "Troll", scale: 0.85, idle: { motion: "breath" as const } },
    };
    expect(manager.getStructureModelIndices(structure)).toEqual([
      SITE_LANDMARK_MODEL_INDEX,
      frontierBeastModelIndex("troll"),
    ]);
    manager.addVisibleStructureInstance(structure, new Set(), new Set());
    expect(campModel.matrices).toHaveLength(1);
    expect(trollModel.matrices).toHaveLength(1);
    expect(placementOf(campModel.matrices[0])).toEqual({
      x: 0,
      y: 0,
      z: composition.baseZ,
      scale: composition.baseScale,
    });
    expect(placementOf(trollModel.matrices[0])).toEqual({
      x: 0,
      y: composition.beastY,
      z: composition.beastZ,
      scale: 0.85,
    });
    expect(manager.dummy.position.toArray()).toEqual([0, 0, 0]);
    expect(manager.dummy.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("selects a deterministic seeded ruin variant per hex and preserves it after clearing", () => {
    const manager = bindManager(new Map());
    const coords = { col: 14, row: -9 };
    const expectedIndex = ruinVariantModelIndex(ruinVariantForHex(coords.col, coords.row));
    const guarded = {
      entityId: SITE,
      structureName: "Fallen Hold",
      hexCoords: coords,
      stage: 0,
      level: 0,
      isMine: false,
      isAlly: false,
      owner: { address: 0n, ownerName: "", guildName: "" },
      structureType: StructureType.Ruin,
      hasWonder: false,
      frontierBeast: { beast: "wyvern" as const, name: "Wyvern", scale: 1.15, idle: { motion: "breath" as const } },
    };
    const cleared = { ...guarded, frontierBeast: undefined };
    expect(manager.getStructureModelIndices(guarded)).toEqual([expectedIndex, frontierBeastModelIndex("wyvern")]);
    expect(manager.getStructureModelIndices(cleared)).toEqual([expectedIndex]);
  });

  it("draws a supply post from its tile's occupier with the clearing Aspect's standard beside it", () => {
    const { store } = campBeside();
    store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: {
          ...store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
          clear: { explorer_id: 201n, home_id: 7n, reward: null },
        },
      },
      { model: "Structure", key: "0x71", value: null },
      { model: "Guard", key: "0x73", value: null },
      {
        model: "TileOccupancy",
        key: "0x7710",
        value: { game_id: 1, ...SITE_TILE, entity_id: SITE, category: TileOccupier.SupplyPost, is_structure: true },
      },
    ] as never);
    const projection = new WorldSpatialProjection({ store });
    projection.start();
    const home = store.require("Structure", { game_id: 1, entity_id: REALM });

    const supplyPost = makeModel();
    const campStandard = makeModel(true);
    const campStandardIndex = mode.assets.structureModelPaths[StructureType.Camp].length - 1;
    const manager = bindManager(
      new Map([
        [
          StructureType.Camp,
          new Map([
            [SUPPLY_POST_MODEL_INDEX, supplyPost],
            [campStandardIndex, campStandard],
          ]),
        ],
      ]),
    );
    const builder = Object.assign(manager, { store }) as unknown as {
      buildStructureInfo(renderable: unknown): Record<string, unknown>;
    };

    const [renderable] = projection.getStructuresAtHex(SITE_TILE);
    const post = builder.buildStructureInfo(renderable);
    expect(post).toMatchObject({
      entityId: SITE,
      structureType: StructureType.Camp,
      supplyPost: true,
      realmOrder: home.metadata.order,
      owner: { address: home.owner },
    });
    projection.dispose();

    const friendlyPost = { ...post, isMine: true, realmOrder: 1 };
    expect(manager.getStructureModelIndices(friendlyPost)).toEqual([SUPPLY_POST_MODEL_INDEX, campStandardIndex]);
    manager.addVisibleStructureInstance(friendlyPost, new Set(), new Set());
    expect(supplyPost.matrices).toHaveLength(1);
    expect(campStandard.matrices).toHaveLength(1);
    expect(placementOf(supplyPost.matrices[0])).toEqual({ x: 0, y: 0, z: 0, scale: 1 });
    expect(placementOf(campStandard.matrices[0])).toEqual(SUPPLY_POST_STANDARD);
    expect(campStandard.setAspectAt).toHaveBeenCalledWith(0, orderAspect(1));
    expect(campStandard.setRelationshipAt).not.toHaveBeenCalled();

    manager.addVisibleStructureInstance({ ...post, entityId: SITE + 2, isMine: false }, new Set(), new Set());
    expect(campStandard.setRelationshipAt).toHaveBeenCalledWith(1, "enemy");
  });
});

it("draws nothing on a cleared site: no model and no plate, and takes away the plate it had", () => {
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
    attachmentManager: { removeAttachments: vi.fn() },
    activeStructureAttachmentEntities: new Set(),
    structureAttachmentSignatures: new Map(),
    structuresWithActiveTimedLabels: new Set(),
    incomingTroopArrivalsByStructure: new Map(),
    battleDirectionsByStructure: new Map(),
  }) as { refreshStructurePresentation(entityId: number): void; compactLabelIds: Set<number> };
  chainAt(400);
  manager.refreshStructurePresentation(SITE);
  expect(
    (manager as unknown as { resolveStructureInfoByEntityId(id: number): unknown }).resolveStructureInfoByEntityId(
      SITE,
    ),
  ).toBeUndefined();
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
        tier: null,
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
