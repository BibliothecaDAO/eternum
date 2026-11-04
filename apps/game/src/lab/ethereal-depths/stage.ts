import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import { Euler, Matrix4, Vector3 } from "three";
import { ARMY_PLATE_HEIGHT } from "@/three/constants/army-constants";
import { SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import InstancedModel from "@/three/managers/instanced-model";
import { SpireModel } from "@/three/structures/spire-model";
import { BASALT_SUPPORT_HEIGHT } from "@/three/terrain/terrain-basalt";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import { ProceduralArmyCharacterLayer } from "@/three/characters/procedural-army-character-layer";
import { gltfLoader } from "@/three/utils/utils";

type Depth = 1 | 2 | 3;
const ARMY_HEX = { col: 0, row: 1 };
const SPIRE_HEX = { col: -1, row: -1 };

export function readDepthLook(query: URLSearchParams): { set: "current" | "violet"; depth: Depth } {
  const set = query.get("set") ?? "violet";
  if (set !== "current" && set !== "violet") throw new Error("Unknown depth look set");
  const depth = Number(query.get("depth") ?? 1);
  if (depth !== 1 && depth !== 2 && depth !== 3) throw new Error("Unknown Ethereal depth");
  return { set, depth };
}

/** The production depth renderer with the shipped models at their real scale. */
export class EtherealDepthStage implements LabStage {
  readonly request: TerrainPageRequest;
  private context: LabStageContext | null = null;
  private readonly models: InstancedModel[] = [];
  private labelPoints: Vector3[] = [];
  private army: ProceduralArmyCharacterLayer | null = null;

  constructor(
    depth: Depth | null,
    private readonly labels: HTMLDivElement,
  ) {
    this.request = createDepthRequest(depth);
  }

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    context.terrain.setSurfacePresentation("ethereal");
    this.frameCamera();
    await this.placeSubjects();
    this.update(0);
  }

  update(_delta: number): void {
    if (!this.context) return;
    const { camera } = this.context;
    camera.updateMatrixWorld();
    this.labelPoints.forEach((point, index) => {
      const projected = point.clone().project(camera);
      const label = this.labels.children[index] as HTMLElement;
      label.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
      label.style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`;
    });
  }

  dispose(): void {
    this.army?.dispose();
    for (const model of this.models) model.dispose();
    this.models.length = 0;
    this.context = null;
  }

  private frameCamera(): void {
    const { camera, controls } = this.context!;
    controls.target.set(0, 1, 0);
    // Equal camera per device across every option; the phone keeps both subjects in its narrow frame.
    const distance = camera.aspect < 1 ? 16 : 12;
    camera.position.set(0, distance, distance * 1.1);
    camera.lookAt(controls.target);
    controls.update();
  }

  private async placeSubjects(): Promise<void> {
    const spire = await this.placeSpire();
    await this.placeArmy();
    this.labelPoints = [subjectPoint(SPIRE_HEX, spire.labelHeight), subjectPoint(ARMY_HEX, ARMY_PLATE_HEIGHT)];
  }

  private async placeSpire(): Promise<SpireModel> {
    const { scene, camera, compile } = this.context!;
    const spire = new SpireModel(await gltfLoader.loadAsync(SPIRE_MODEL_PATH), 1);
    this.models.push(spire);
    spire.setCount(1);
    spire.setMatrixAt(0, subjectMatrix(SPIRE_HEX));
    spire.updateAnimations(0, { camera });
    await compile(spire.group, scene);
    scene.add(spire.group);
    return spire;
  }

  private async placeArmy(): Promise<void> {
    this.army = new ProceduralArmyCharacterLayer(this.context!.scene);
    this.army.setShadowsEnabled(true);
    const started = performance.now();
    while (!this.army.hasActor(1)) {
      this.army.sync(
        [
          {
            category: TroopType.Knight,
            tier: TroopTier.T1,
            entityId: 1,
            isNaval: false,
            isMoving: false,
            primaryColor: "#75b5c7",
            distanceToCameraSquared: 0,
            position: subjectPoint(ARMY_HEX, 0),
            rotation: new Euler(0, Math.PI, 0),
          },
        ],
        0,
      );
      if (this.army.getStats().loadState === "failed" || performance.now() - started > 20000)
        throw new Error("Depth study army failed to load");
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
}

function createDepthRequest(depth: Depth | null): TerrainPageRequest {
  const cells = [];
  for (let row = -12; row <= 12; row++)
    for (let col = -12; col <= 12; col++)
      cells.push({
        col,
        row,
        biome: BiomeType.Underground,
        previewBiome: BiomeType.Underground,
        explored: true,
        occupied: Math.hypot(col, row) < 3,
        ...(depth ? { surfacePresentation: depth } : {}),
      });
  return {
    cells,
    halo: [],
    climate: NEUTRAL_BIOME_CLIMATE,
    mapCenter: 0,
    pageKey: "ethereal-depth-study",
    surfacePresentation: "ethereal",
    roadSegments: [],
    settlementAnchors: [],
  };
}

function subjectPoint(hex: { col: number; row: number }, height: number): Vector3 {
  const p = terrainHexToWorld(hex.col, hex.row);
  return new Vector3(p.x, BASALT_SUPPORT_HEIGHT + height, p.z);
}

function subjectMatrix(hex: { col: number; row: number }): Matrix4 {
  return new Matrix4().setPosition(subjectPoint(hex, 0));
}
