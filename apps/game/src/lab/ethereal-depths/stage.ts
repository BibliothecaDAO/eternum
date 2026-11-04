import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import { Euler, BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import { color, mix, positionWorld, smoothstep } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ARMY_PLATE_HEIGHT } from "@/three/constants/army-constants";
import { SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import InstancedModel from "@/three/managers/instanced-model";
import { SpireModel } from "@/three/structures/spire-model";
import { BASALT_SUPPORT_HEIGHT } from "@/three/terrain/terrain-basalt";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { createBasaltSurface } from "@/three/terrain/terrain-ethereal-material";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import { ProceduralArmyCharacterLayer } from "@/three/characters/procedural-army-character-layer";
import { gltfLoader } from "@/three/utils/utils";
import looks from "./looks.json";

type Depth = 1 | 2 | 3;
type Look = (typeof looks.mineral.depths)[1];
const DEPTH_LOOKS: Record<keyof typeof looks, { depths: Record<Depth, Look> }> = looks;
const ARMY_HEX = { col: 0, row: 1 };
const SPIRE_HEX = { col: -1, row: -1 };

export function readDepthLook(query: URLSearchParams): {
  set: "current" | keyof typeof looks;
  depth: Depth;
  look: Look | null;
} {
  const set = query.get("set") ?? "current";
  if (set !== "current" && set !== "mineral" && set !== "violet") throw new Error("Unknown depth look set");
  const depth = Number(query.get("depth") ?? 1);
  if (depth !== 1 && depth !== 2 && depth !== 3) throw new Error("Unknown Ethereal depth");
  return { set, depth, look: set === "current" ? null : DEPTH_LOOKS[set].depths[depth] };
}

/** The existing basalt page, models, lighting and scale; only the proposed ground treatment belongs to this lab. */
export class EtherealDepthStage implements LabStage {
  readonly request = createDepthRequest();
  private context: LabStageContext | null = null;
  private readonly models: InstancedModel[] = [];
  private readonly props = new Group();
  private material: MeshStandardNodeMaterial | null = null;
  private labelPoints: Vector3[] = [];
  private army: ProceduralArmyCharacterLayer | null = null;

  constructor(
    private readonly look: Look | null,
    private readonly labels: HTMLDivElement,
  ) {}

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    context.terrain.setSurfacePresentation("ethereal");
    this.frameCamera();
    if (this.look) this.presentLook(this.look);
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
    this.props.removeFromParent();
    this.props.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry.dispose();
      if (!Array.isArray(node.material)) node.material.dispose();
    });
    this.material?.dispose();
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

  private presentLook(look: Look): void {
    const { terrain, scene } = this.context!;
    this.material = createDepthMaterial(look);
    terrain.object3d.traverse((node) => {
      if (node instanceof Mesh && node.name === "procedural-terrain-basalt") node.material = this.material!;
    });
    this.props.add(createMineralScatter(this.request, look));
    scene.add(this.props);
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

function createDepthRequest(): TerrainPageRequest {
  const cells = [];
  for (let row = -12; row <= 12; row++)
    for (let col = -12; col <= 12; col++)
      cells.push({
        col,
        row,
        biome: BiomeType.Underground,
        previewBiome: BiomeType.Underground,
        explored: true,
        occupied: false,
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

function createDepthMaterial(look: Look): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  const ground = positionWorld.xz;
  const basalt = createBasaltSurface(ground.mul(look.scale));
  const slab = basalt.slab;
  const strata = ground.x.mul(0.63).add(ground.y.mul(0.4).sin().mul(1.7)).sin().mul(0.5).add(0.5);
  const fissure = smoothstep(0.91, 0.99, strata).mul(slab.oneMinus());
  material.colorNode = mix(color(look.shadow), color(look.stone), slab.mul(strata.mul(0.3).add(0.7)));
  material.emissiveNode = color(look.energy).mul(fissure).mul(look.veins);
  return material;
}

function createMineralScatter(request: TerrainPageRequest, look: Look): InstancedMesh {
  const points = request.cells.flatMap((cell) => {
    const p = terrainHexToWorld(cell.col, cell.row);
    const seed = Math.abs(Math.sin(cell.col * 127.1 + cell.row * 311.7) * 43758.5453) % 1;
    if (Math.hypot(p.x, p.z) < 2.7 || seed > look.density) return [];
    return [{ ...p, seed }];
  });
  const geometry = createMineralGeometry(look.shape);
  const material = new MeshStandardNodeMaterial({
    color: look.stone,
    roughness: 0.75,
    emissive: look.energy,
    emissiveIntensity: look.shape === "crystal" ? 0.12 : 0,
  });
  const grain = positionWorld.x
    .mul(37)
    .add(positionWorld.z.mul(29))
    .add(positionWorld.y.mul(43))
    .sin()
    .mul(0.07)
    .add(0.93);
  material.colorNode = color(look.stone).mul(grain);
  const mesh = new InstancedMesh(geometry, material, points.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  points.forEach((point, index) => {
    const height = look.height * (0.6 + point.seed / look.density);
    const width = look.shape === "shelf" ? 1.7 : 0.7;
    const matrix = new Matrix4().makeRotationY(point.seed * 30).scale(new Vector3(width, height, width));
    matrix.setPosition(point.x + 0.48, BASALT_SUPPORT_HEIGHT + height / 2, point.z - 0.4);
    mesh.setMatrixAt(index, matrix);
  });
  return mesh;
}

function subjectPoint(hex: { col: number; row: number }, height: number): Vector3 {
  const p = terrainHexToWorld(hex.col, hex.row);
  return new Vector3(p.x, BASALT_SUPPORT_HEIGHT + height, p.z);
}

function subjectMatrix(hex: { col: number; row: number }): Matrix4 {
  return new Matrix4().setPosition(subjectPoint(hex, 0));
}

/** Three joined, chipped mineral sections form a cluster, with flat faces and uneven broken tops. */
function createMineralGeometry(shape: string): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const crystal = shape === "crystal";
  const pieces = [
    { x: 0, z: 0, height: 1, radius: crystal ? 0.16 : 0.27 },
    { x: 0.22, z: 0.07, height: 0.58, radius: crystal ? 0.12 : 0.21 },
    { x: -0.14, z: -0.19, height: 0.42, radius: crystal ? 0.1 : 0.18 },
  ];
  for (const [pieceIndex, piece] of pieces.entries()) {
    const start = positions.length / 3;
    const rings = crystal
      ? [
          [0, 0.8],
          [0.74, 1],
          [1, 0.06],
        ]
      : [
          [0, 0.85],
          [0.14, 1],
          [0.85, 0.9],
          [1, 0.65],
        ];
    for (const [height, radius] of rings) {
      for (let side = 0; side < 6; side++) {
        const angle = (side * Math.PI) / 3 + pieceIndex * 0.6;
        const chip = 0.84 + 0.16 * Math.sin(side * 7.3 + pieceIndex);
        positions.push(
          piece.x + Math.cos(angle) * radius * piece.radius * chip + height * (crystal ? 0.09 : 0.02),
          -0.5 + height * piece.height * (0.9 + 0.1 * Math.cos(side * 2.4 + pieceIndex)),
          piece.z + Math.sin(angle) * radius * piece.radius * chip,
        );
      }
    }
    for (let ring = 0; ring < rings.length - 1; ring++)
      for (let side = 0; side < 6; side++) {
        const a = start + ring * 6 + side,
          b = start + ring * 6 + ((side + 1) % 6);
        indices.push(a, a + 6, b, b, a + 6, b + 6);
      }
    const top = start + (rings.length - 1) * 6;
    for (let side = 1; side < 5; side++) indices.push(top, top + side + 1, top + side);
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute("position", new Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
}
