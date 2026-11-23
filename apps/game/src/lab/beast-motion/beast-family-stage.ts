import { DEEP_BEASTS, beastsOfFamily, type BeastFamily, type BeastIdle } from "@bibliothecadao/types";
import { BufferGeometry, Group, Line, LineBasicMaterial, Matrix4, Quaternion, Vector3 } from "three";
import { FRONTIER_BEASTS, type FrontierSpecies } from "@/three/structures/frontier-beast";
import { FrontierModel, type BeastLayer } from "@/three/structures/frontier-model";
import { terrainHexCorners } from "@/three/terrain/terrain-coordinates";
import { gltfLoader } from "@/three/utils/gltf-loader";

export type BeastFamilyShowcaseId = BeastFamily | "deep";

export const BEAST_FAMILY_SHOWCASE_IDS: readonly BeastFamilyShowcaseId[] = [
  "herd",
  "band",
  "camp",
  "rift",
  "ruin",
  "deep",
];

export const BEAST_FAMILY_LABELS: Readonly<Record<BeastFamilyShowcaseId, string>> = {
  herd: "Herd",
  band: "Band",
  camp: "Camp",
  rift: "Rift",
  ruin: "Ruin",
  deep: "Deep",
};

export const BEAST_FAMILY_SHOWCASE_LAYERS = {
  herd: 0,
  band: 1,
  camp: 0,
  rift: 1,
  ruin: 2,
  deep: 3,
} satisfies Record<BeastFamilyShowcaseId, BeastLayer>;

interface FamilyMember {
  readonly name: string;
  readonly species: FrontierSpecies;
  readonly layer: BeastLayer;
  readonly scale: number;
  readonly idle: BeastIdle;
}

interface MountedFamilyBeast {
  readonly member: FamilyMember;
  readonly model: FrontierModel;
  readonly position: Vector3;
}

export interface FamilyBeastLabelAnchor {
  readonly name: string;
  readonly position: Vector3;
}

const MATRIX_TMP = new Matrix4();
const QUAT_TMP = new Quaternion();
const POS_TMP = new Vector3();
const SCALE_TMP = new Vector3();

function resolveFamilyMembers(family: BeastFamilyShowcaseId): FamilyMember[] {
  if (family === "deep") {
    return Object.values(DEEP_BEASTS).map((row) => ({
      name: row.name,
      species: row.model,
      layer: 3,
      scale: row.scale,
      idle: row.idle,
    }));
  }
  return beastsOfFamily(family).map((row) => ({
    name: row.name,
    species: row.model,
    layer: row.layer,
    scale: row.scale,
    idle: row.idle,
  }));
}

function createHexOutline(centerX: number, centerZ: number, groundY: number): Line {
  const corners = terrainHexCorners(centerX, centerZ);
  const points = corners.map(({ x, z }) => new Vector3(x, groundY + 0.015, z));
  points.push(points[0].clone());
  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({ color: 0xf4dca8, transparent: true, opacity: 0.48 });
  const line = new Line(geometry, material);
  line.renderOrder = 6;
  return line;
}

export class BeastFamilyStage {
  public readonly group = new Group();
  private readonly mounted: MountedFamilyBeast[] = [];
  private readonly outlines: Line[] = [];
  private activeFamily: BeastFamilyShowcaseId | null = null;
  private generation = 0;

  public async loadFamily(
    family: BeastFamilyShowcaseId,
    sampleGroundY: (x: number, z: number) => number,
    layerOverride?: BeastLayer,
  ): Promise<void> {
    const token = ++this.generation;
    const members = resolveFamilyMembers(family);
    const gltfs = await Promise.all(
      members.map((member) => gltfLoader.loadAsync(FRONTIER_BEASTS[member.species].path)),
    );
    if (token !== this.generation) return;

    this.clear();
    this.activeFamily = family;
    const spacing = members.length >= 4 ? 2.05 : 2.25;
    const halfSpan = ((members.length - 1) * spacing) / 2;

    members.forEach((member, index) => {
      const x = index * spacing - halfSpan;
      const z = 0;
      const groundY = sampleGroundY(x, z);
      const model = new FrontierModel(gltfs[index], 2, member.species);
      POS_TMP.set(x, groundY, z);
      QUAT_TMP.identity();
      SCALE_TMP.setScalar(member.scale);
      MATRIX_TMP.compose(POS_TMP, QUAT_TMP, SCALE_TMP);
      model.setMatrixAt(0, MATRIX_TMP);
      model.setIdleAt(0, member.idle);
      model.setLayerAt(0, layerOverride ?? member.layer);
      model.setCount(1);
      model.needsUpdate();
      this.group.add(model.group);
      this.mounted.push({ member, model, position: new Vector3(x, groundY, z) });

      const outline = createHexOutline(x, z, groundY);
      this.group.add(outline);
      this.outlines.push(outline);
    });
  }

  public getFamily(): BeastFamilyShowcaseId | null {
    return this.activeFamily;
  }

  public setLayer(layer: BeastLayer): void {
    for (const entry of this.mounted) {
      entry.model.setLayerAt(0, layer);
    }
  }

  public triggerAction(action: "idle" | "attack" | "hit" | "death"): void {
    for (const entry of this.mounted) {
      if (action === "attack") entry.model.playAttackAt(0);
      else if (action === "hit") entry.model.playHitAt(0);
      else if (action === "death") entry.model.playDeathAt(0);
      else entry.model.resetMotionAt(0);
    }
  }

  public update(deltaSeconds: number): void {
    for (const entry of this.mounted) {
      entry.model.updateAnimations(deltaSeconds);
    }
  }

  public getLabelAnchors(): FamilyBeastLabelAnchor[] {
    return this.mounted.map((entry) => ({
      name: entry.member.name,
      position: new Vector3(entry.position.x, entry.position.y + 1.45, entry.position.z),
    }));
  }

  public getMemberCount(): number {
    return this.mounted.length;
  }

  public clear(): void {
    while (this.mounted.length > 0) {
      const entry = this.mounted.pop()!;
      this.group.remove(entry.model.group);
      entry.model.dispose();
    }
    while (this.outlines.length > 0) {
      const line = this.outlines.pop()!;
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
      this.group.remove(line);
    }
  }

  public dispose(): void {
    this.generation++;
    this.clear();
    this.group.removeFromParent();
  }
}
