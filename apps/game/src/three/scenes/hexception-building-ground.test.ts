// @vitest-environment jsdom
import gsap from "gsap";
import { Box3, BoxGeometry, Group, Matrix4, Mesh, Scene } from "three";
import { expect, it } from "vitest";
import { BuildingType, StructureType } from "@bibliothecadao/types";
import { BUILDINGS_GROUPS } from "../constants/scene-constants";
import { prepareBuildingModel } from "./hexception-models";

const { default: HexceptionScene } = await import("./hexception");

function buildingTemplate(base: number) {
  const source = new Group();
  const nested = new Group();
  nested.position.y = base + 1;
  nested.add(new Mesh(new BoxGeometry(1, 2, 1)));
  source.add(nested);
  return prepareBuildingModel(source);
}

function boardAt(base: number) {
  let floor = 0;
  const template = buildingTemplate(base);
  const building = {
    col: 11,
    row: 10,
    category: BuildingType.WorkersHut,
    tier: 1,
    matrix: new Matrix4().setPosition(2, 0.05, 3),
  };
  const board = Object.assign(Object.create(HexceptionScene.prototype), {
    scene: new Scene(),
    buildings: [building],
    buildingInstances: new Map<string, Group>(),
    pendingBuildingKeys: new Set<string>(),
    labels: [],
    models: { get: () => ({ model: template, animations: [] }) },
    proceduralTerrain: { sampleSurface: () => ({ height: floor }), present: () => {} },
    interactiveHexManager: { renderAllHexes: () => {} },
    selectBuildingModel: () => ({ group: BUILDINGS_GROUPS.BUILDINGS, type: building.category }),
    modelPath: () => "building.glb",
    applyMiningBuildingMaterial: () => {},
    renderRestingOrNewRing: () => {},
  });
  const reconcile = () => {
    board.reconcileAllBuildingInstances(StructureType.Realm);
    gsap.globalTimeline.getChildren().forEach((tween) => tween.progress(1));
    return board.buildingInstances.get("11,10") as Group;
  };
  return { board, building, reconcile, setFloor: (height: number) => (floor = height) };
}

it.each([-0.4, 0.3])("grounds an authored base at %s through placement and growth", (base) => {
  const view = boardAt(base);
  view.setFloor(0.7);
  const model = view.reconcile();
  expect(new Box3().setFromObject(model, true).min.y).toBeCloseTo(0.7, 6);
  model.scale.set(0.8, 0.7, 0.8);
  expect(new Box3().setFromObject(model, true).min.y).toBeCloseTo(0.7, 6);
});

it("moves an already loaded building onto newly presented terrain without replacing it", () => {
  const view = boardAt(-0.03);
  const before = view.reconcile();
  view.setFloor(0.45);
  view.board.presentGrid({}, StructureType.Realm);
  const after = view.reconcile();
  expect(after).toBe(before);
  expect(new Box3().setFromObject(after, true).min.y).toBeCloseTo(0.45, 6);
  view.setFloor(0.12);
  view.board.presentGrid({}, StructureType.Realm);
  expect(new Box3().setFromObject(after, true).min.y).toBeCloseTo(0.12, 6);
});

it("places a targeted new building from the current terrain rather than its provisional matrix", () => {
  const view = boardAt(0.08);
  view.setFloor(0.32);
  view.board.reconcileBuildingInstance(view.building, view.building, StructureType.Realm);
  const model = view.reconcile();
  expect(new Box3().setFromObject(model, true).min.y).toBeCloseTo(0.32, 6);
  expect(model.position.x).toBe(2);
  expect(model.position.z).toBe(3);
});
