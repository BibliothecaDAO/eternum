// @vitest-environment jsdom
import { Vector3 } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ModelType } from "@/three/types/army";
import { ArmyManager } from "./army-manager";

const originalOverlay = useUIStore.getState().showBlankOverlay;
afterEach(() => useUIStore.setState({ showBlankOverlay: originalOverlay }));

it("requests characters only for eligible units in the visible scene and uses camera distance for LOD", () => {
  const position = new Vector3();
  let model = ModelType.Crossbowman2;
  let inFrustum = true;
  const presented: { entityId: number; distanceToCameraSquared: number }[][] = [];
  const manager = Object.assign(Object.create(ArmyManager.prototype), {
    contentLadder: { armyModels: true, proceduralCharacters: false },
    armyPresentations: new Map([
      [42, { entityId: 42, category: TroopType.Knight, tier: TroopTier.T1, color: "#ffffff" }],
    ]),
    visibleArmyOrder: [42],
    proceduralArmyPresentationBuffer: [],
    proceduralArmyPresentations: new Map(),
    desiredProceduralArmyEntityIds: new Set(),
    readyProceduralArmyEntityIds: new Set(),
    activeProceduralArmyEntityIds: new Set(),
    proceduralArmyCharacterLayer: {
      sync: (values: (typeof presented)[number]) => presented.push(values.map((value) => ({ ...value }))),
      hasActor: () => false,
    },
    hexagonScene: { getCamera: () => ({ position: new Vector3(0, 20, 0) }) },
    armyModel: {
      getInstanceData: () => ({ position }),
      getAssignedModelType: () => model,
      isEntityMoving: () => false,
      flushInstanceUploads: vi.fn(),
    },
    labelPool: { flushBatch: vi.fn() },
    slotAuditFrameCounter: 0,
    toNumericId: (id: number) => id,
    flushVisibleArmyPresentation: vi.fn(),
    updateVisibleArmyPresentation: vi.fn(),
    syncArmyBoundsForMovementState: vi.fn(),
  });
  const visibility = {
    cameraPosition: position,
    maxDistance: 100,
    visibilityManager: { isPointVisible: () => inFrustum },
  };
  const tick = () => manager.update(0, visibility, true);

  useUIStore.setState({ showBlankOverlay: true });
  model = ModelType.Knight1;
  tick();
  expect(presented.at(-1)).toEqual([]);
  useUIStore.setState({ showBlankOverlay: false });
  model = ModelType.Crossbowman2;
  tick();
  expect(presented.at(-1)).toEqual([]);
  model = ModelType.Knight1;
  inFrustum = false;
  tick();
  expect(presented.at(-1)).toEqual([]);
  inFrustum = true;
  tick();
  expect(presented.at(-1)).toEqual([expect.objectContaining({ entityId: 42, distanceToCameraSquared: 400 })]);
  useUIStore.setState({ showBlankOverlay: true });
  tick();
  expect(presented.at(-1)).toEqual([]);
});
