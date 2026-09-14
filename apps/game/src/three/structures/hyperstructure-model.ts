import { Color, Euler, Matrix4, Mesh, MeshStandardMaterial, Quaternion, type Texture, Vector3 } from "three";
import InstancedModel from "../managers/instanced-model";
import { queueInstanceUpdate } from "../utils/instance-update-ranges";
import {
  HYPERSTRUCTURE_BASE_HEIGHT,
  HYPERSTRUCTURE_COURSES,
  HYPERSTRUCTURE_HEIGHT,
  HYPERSTRUCTURE_SHAFT_HEIGHT,
  resolveHyperstructureDesign,
  resolveHyperstructureCourse,
  HYPERSTRUCTURE_CROWNS,
  type HyperstructureConstruction,
  type HyperstructureCrown,
} from "./hyperstructure-design";
import { createHyperstructureKit } from "./hyperstructure-kit";
import { createHyperstructurePower } from "./hyperstructure-power";
import { MaterialPool } from "../utils/material-pool";

interface TowerPlacement {
  matrix: Matrix4;
  construction: HyperstructureConstruction;
  design: ReturnType<typeof resolveHyperstructureDesign>;
  activationAge: number;
  visualProgress: number;
  activationPending: boolean;
}

const BUILD_SECONDS = 2.4;
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const CROWN_SPIN: Record<HyperstructureCrown, number> = {
  prongs: 0,
  astrolabe: 0.55,
  petals: -0.32,
  crystals: 0.38,
  crescent: 0.3,
  cage: -0.28,
  spear: 0.6,
  wings: 0.12,
};
const CROWN_Y = HYPERSTRUCTURE_BASE_HEIGHT + HYPERSTRUCTURE_SHAFT_HEIGHT;

/** Shared kit draws retain manager slot IDs for picking; construction rises before the crown awakens. */
export class HyperstructureModel extends InstancedModel {
  private readonly placements = new Map<number, TowerPlacement>();
  private readonly presentations = new Map<number, TowerPlacement>();
  private readonly visibleSlots = new Map<number, Set<number>>();
  private readonly stoneTexture: Texture;
  private readonly parts: { name: string; family?: string; course?: number; masonry: boolean }[];
  private readonly masonryTint = new Color();
  private readonly local = new Matrix4();
  private readonly composed = new Matrix4();
  private readonly scale = new Vector3();
  private readonly rotation = new Euler();
  private readonly orientation = new Quaternion();
  private readonly position = new Vector3();
  private readonly partHeights: number[];
  private readonly power: ReturnType<typeof createHyperstructurePower>;
  private seconds = 0;

  constructor(capacity: number) {
    const kit = createHyperstructureKit();
    super(kit, capacity, false, "Hyperstructure");
    this.stoneTexture = ((kit.scene.children[0] as Mesh).material as MeshStandardMaterial).map!;
    this.power = createHyperstructurePower(capacity);
    this.parts = kit.scene.children.map((part, index) => {
      this.instancedMeshes[index].name = part.name;
      const [kind, family, course] = part.name.split(":");
      const masonry = (part as Mesh).material === (kit.scene.children[0] as Mesh).material;
      if (masonry) this.instancedMeshes[index].setColorAt(0, this.masonryTint);
      if (["core", "orb", "spear:satellite", "activation"].includes(part.name)) {
        const mesh = this.instancedMeshes[index];
        mesh.geometry.setAttribute("hyperstructurePower", this.power.instances);
        MaterialPool.getInstance().releaseMaterial(mesh.material as MeshStandardMaterial);
        mesh.material = this.power.material;
        mesh.castShadow = false;
      }
      return {
        name: part.name,
        masonry,
        family: kind === "course" ? family : undefined,
        course: course === undefined ? undefined : Number(course),
      };
    });
    this.partHeights = this.instancedMeshes.map((mesh) => {
      mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox!.max.y;
    });
    this.setContactShadowsEnabled(false);
  }

  override setMatrixAt(index: number, matrix: Matrix4): void {
    super.setMatrixAt(index, matrix);
    if (matrix.determinant() === 0) {
      this.placements.delete(index);
      this.parts.forEach((_, meshIndex) => this.hidePart(meshIndex, index));
      return;
    }
    const placement = this.placements.get(index) ?? {
      matrix: new Matrix4(),
      construction: { entityId: 0, progress: 0, completed: false },
      design: resolveHyperstructureDesign(0),
      activationAge: Infinity,
      visualProgress: 0,
      activationPending: false,
    };
    placement.matrix.copy(matrix);
    this.placements.set(index, placement);
    this.writeTower(index, placement);
  }

  setConstructionAt(index: number, construction: HyperstructureConstruction, animateFromFoundation = false): void {
    const placement = this.placements.get(index);
    if (!placement) return;
    if (placement.construction.entityId !== construction.entityId) {
      this.presentations.delete(placement.construction.entityId);
    }
    const retained = this.presentations.get(construction.entityId);
    const previous = retained?.construction;
    const target = constructionProgress(construction);
    // Existing snapshots appear settled. Only observed changes (or a visible claimed site) animate.
    placement.visualProgress = Math.min(target, retained?.visualProgress ?? (animateFromFoundation ? 0 : target));
    placement.activationAge = retained?.activationAge ?? Infinity;
    placement.activationPending =
      construction.completed && (previous ? !previous.completed || retained.activationPending : animateFromFoundation);
    if (!construction.completed) placement.activationAge = Infinity;
    placement.design = resolveHyperstructureDesign(construction.entityId);
    this.power.instances.setXY(index, placement.design.power === "unstable" ? 1 : 0, placement.design.phase);
    queueInstanceUpdate(this.power.instances, index, 1);
    placement.construction = { ...construction };
    this.presentations.set(construction.entityId, placement);
    this.tintMasonry(index, placement);
    this.writeTower(index, placement);
    this.needsUpdate();
  }

  override setCount(count: number): void {
    for (const index of this.placements.keys()) {
      if (index >= count) {
        this.placements.delete(index);
        this.parts.forEach((_, meshIndex) => this.hidePart(meshIndex, index));
      }
    }
    const activeIds = new Set([...this.placements.values()].map((placement) => placement.construction.entityId));
    for (const id of this.presentations.keys()) if (!activeIds.has(id)) this.presentations.delete(id);
    super.setCount(count);
  }

  override updateAnimations(delta: number): void {
    if (delta <= 0 || !this.group.visible) return;
    this.seconds += delta;
    this.power.time.value = this.seconds;
    let boundsChanged = false;
    for (const [index, placement] of this.placements) {
      const building = advanceConstruction(placement, delta);
      if (building) {
        this.writeTower(index, placement);
        boundsChanged = true;
      } else if (placement.construction.completed) {
        this.writeCrown(index, placement);
      }
    }
    if (boundsChanged) this.needsUpdate();
  }

  override dispose(): void {
    this.placements.clear();
    this.presentations.clear();
    this.visibleSlots.clear();
    super.dispose();
    this.stoneTexture.dispose();
  }

  private tintMasonry(index: number, placement: TowerPlacement): void {
    const [red, green, blue] = placement.design.masonryTint;
    this.masonryTint.setRGB(red, green, blue);
    this.parts.forEach((part, meshIndex) => {
      if (!part.masonry) return;
      const mesh = this.instancedMeshes[meshIndex];
      mesh.setColorAt(index, this.masonryTint);
      queueInstanceUpdate(mesh.instanceColor!, index, 1);
    });
  }

  private writeTower(index: number, placement: TowerPlacement): void {
    const visibleCourses = Math.min(HYPERSTRUCTURE_COURSES, (placement.visualProgress / 90) * HYPERSTRUCTURE_COURSES);
    this.parts.forEach((part, meshIndex) => {
      if (part.name === "base") this.writePart(meshIndex, index, placement, 0, 1, 1, 0);
      if (part.course === undefined) return;
      if (part.family !== placement.design.family || part.course >= visibleCourses) {
        this.hidePart(meshIndex, index);
        return;
      }
      const { y, radius, yaw } = resolveHyperstructureCourse(placement.design, part.course);
      const rise = Math.min(1, visibleCourses - part.course);
      const easedRise = rise * rise * (3 - 2 * rise);
      this.writePart(
        meshIndex,
        index,
        placement,
        y,
        radius,
        (HYPERSTRUCTURE_SHAFT_HEIGHT / HYPERSTRUCTURE_COURSES) * easedRise,
        yaw,
      );
    });
    this.writeCrown(index, placement);
  }

  private writeCrown(index: number, placement: TowerPlacement): void {
    this.parts.forEach(({ name: part, course }, meshIndex) => {
      if (part === "base" || course !== undefined) return;
      if (!isCrownPartVisible(part, placement, this.seconds)) {
        this.hidePart(meshIndex, index);
        return;
      }
      switch (part) {
        case "activation":
          this.writeActivation(meshIndex, index, placement);
          break;
        case "core":
        case "orb":
          this.writePowerCore(meshIndex, index, placement);
          break;
        case "collar":
          this.writePart(meshIndex, index, placement, CROWN_Y, 1, crownReveal(placement), placement.design.twist);
          break;
        case "channels":
          this.writePart(meshIndex, index, placement, CROWN_Y + 0.01, 1, 0.15, placement.design.twist);
          break;
        default:
          this.writeCrownMechanism(meshIndex, index, placement);
      }
    });
  }

  private writeActivation(meshIndex: number, index: number, placement: TowerPlacement): void {
    const expansion = crownPulseAge(placement, this.seconds) / 2.5;
    this.writePart(meshIndex, index, placement, CROWN_Y + 0.4, 0.6 + expansion * 1.8, 1 - expansion, 0);
  }

  private writePowerCore(meshIndex: number, index: number, placement: TowerPlacement): void {
    const completed = isAwake(placement);
    const clock = placement.design.phase + (completed ? this.seconds : 0);
    const pulseAge = crownPulseAge(placement, this.seconds);
    const flare = pulseAge < 2.5 ? Math.sin((pulseAge / 2.5) * Math.PI) * 0.32 : 0;
    const pulse =
      (completed ? 1 + Math.sin(clock * 1.4) * (placement.design.power === "unstable" ? 0.035 : 0.01) + flare : 0.4) *
      Math.min(1, placement.design.crownWidth);
    const lift = completed ? Math.sin(clock * 0.9) * (placement.design.power === "unstable" ? 0.025 : 0.008) : 0;
    this.writePart(meshIndex, index, placement, CROWN_Y + 0.44 + lift, pulse, pulse * 1.35, clock * 0.32);
  }

  private writeCrownMechanism(meshIndex: number, index: number, placement: TowerPlacement): void {
    const { crown, crownWidth, twist, phase } = placement.design;
    const clock = isAwake(placement) ? this.seconds + phase : 0;
    const part = this.parts[meshIndex].name;
    const reveal = crownReveal(placement);
    if (part.startsWith("wings:")) return this.writeWings(meshIndex, index, placement, clock, reveal);
    if (part.startsWith("astrolabe:")) return this.writeAstrolabe(meshIndex, index, placement, clock, reveal);
    if (part === "spear:satellite") return this.writeSatellite(meshIndex, index, placement, clock, reveal);
    if (part === "spear") {
      this.writePart(meshIndex, index, placement, CROWN_Y, crownWidth, reveal, twist + clock * 0.6);
      return;
    }
    const spin = clock * CROWN_SPIN[crown];
    const breathing = crown === "petals" || crown === "crystals" ? 1 + Math.sin(clock * 1.5) * 0.08 : 1;
    const height = (HYPERSTRUCTURE_HEIGHT - CROWN_Y) / this.partHeights[meshIndex];
    this.writePart(meshIndex, index, placement, CROWN_Y, crownWidth * breathing, height * reveal, twist + spin);
  }

  private writeWings(meshIndex: number, index: number, placement: TowerPlacement, clock: number, reveal: number): void {
    const side = this.parts[meshIndex].name.endsWith("left") ? -1 : 1;
    const { crownWidth, twist } = placement.design;
    const opening = 0.54 + Math.sin(clock * 1.2) * 0.24;
    const orbit = twist + clock * CROWN_SPIN.wings;
    const reach = side * 0.42 * crownWidth;
    this.writeCrownPose(
      meshIndex,
      index,
      placement,
      Math.cos(orbit) * reach,
      0.49,
      -Math.sin(orbit) * reach,
      crownWidth,
      reveal,
      0,
      orbit,
      side * opening,
    );
  }

  private writeAstrolabe(
    meshIndex: number,
    index: number,
    placement: TowerPlacement,
    clock: number,
    reveal: number,
  ): void {
    const inner = this.parts[meshIndex].name.endsWith("inner");
    this.writeCrownPose(
      meshIndex,
      index,
      placement,
      0,
      0.45,
      0,
      placement.design.crownWidth,
      reveal,
      clock * (inner ? -0.8 : 0.55),
      placement.design.twist + clock * 0.3,
      inner ? Math.PI / 2 : 0.3,
    );
  }

  private writeSatellite(
    meshIndex: number,
    index: number,
    placement: TowerPlacement,
    clock: number,
    reveal: number,
  ): void {
    const orbit = clock * 1.4;
    const width = placement.design.crownWidth;
    this.writeCrownPose(
      meshIndex,
      index,
      placement,
      Math.cos(orbit) * 0.48 * width,
      0.5 + Math.sin(orbit) * 0.335,
      Math.sin(orbit) * 0.4 * width,
      1,
      reveal,
      orbit * 0.4,
      orbit * 2,
      0,
    );
  }

  private writeCrownPose(
    meshIndex: number,
    index: number,
    placement: TowerPlacement,
    x: number,
    y: number,
    z: number,
    radius: number,
    reveal: number,
    pitch: number,
    yaw: number,
    roll: number,
  ): void {
    this.orientation.setFromEuler(this.rotation.set(pitch, yaw, roll, "YXZ"));
    this.local.compose(
      this.position.set(x, CROWN_Y + y * reveal, z),
      this.orientation,
      this.scale.set(radius, reveal, radius),
    );
    this.writePartMatrix(meshIndex, index, placement);
  }

  private writePart(
    meshIndex: number,
    index: number,
    placement: TowerPlacement,
    y: number,
    radius: number,
    height: number,
    yaw: number,
  ): void {
    this.local.makeRotationY(yaw).scale(this.scale.set(radius, height, radius));
    this.local.setPosition(0, y, 0);
    this.writePartMatrix(meshIndex, index, placement);
  }

  private writePartMatrix(meshIndex: number, index: number, placement: TowerPlacement): void {
    this.composed.multiplyMatrices(placement.matrix, this.local);
    const mesh = this.instancedMeshes[meshIndex];
    mesh.setMatrixAt(index, this.composed);
    const slots = this.visibleSlots.get(meshIndex) ?? new Set<number>();
    slots.add(index);
    this.visibleSlots.set(meshIndex, slots);
    mesh.visible = true;
    queueInstanceUpdate(mesh.instanceMatrix, index, 1);
  }

  private hidePart(meshIndex: number, index: number): void {
    const mesh = this.instancedMeshes[meshIndex];
    mesh.setMatrixAt(index, HIDDEN);
    const slots = this.visibleSlots.get(meshIndex);
    slots?.delete(index);
    mesh.visible = Boolean(slots?.size);
    queueInstanceUpdate(mesh.instanceMatrix, index, 1);
  }
}

function isCrownPartVisible(part: string, placement: TowerPlacement, seconds: number): boolean {
  const completed = isAwake(placement);
  const progress = placement.visualProgress;
  const { crown } = placement.design;
  if (part === "activation") return completed && crownPulseAge(placement, seconds) < 2.5;
  if (part === "channels") return completed;
  if (part === "core" || part === "orb") {
    const usesOrb = crown === "astrolabe" || crown === "petals";
    return (completed || progress >= 98) && (part === "orb" ? usesOrb : !usesOrb);
  }
  if (!completed && progress <= 90) return false;
  const family = part.split(":")[0] as HyperstructureCrown;
  return !HYPERSTRUCTURE_CROWNS.includes(family) || family === crown;
}

function constructionProgress(construction: HyperstructureConstruction): number {
  return construction.completed ? 100 : Math.max(0, Math.min(100, construction.progress));
}

function isAwake(placement: TowerPlacement): boolean {
  return placement.construction.completed && placement.visualProgress === 100;
}

function crownReveal(placement: TowerPlacement): number {
  const rise = Math.max(0, Math.min(1, (placement.visualProgress - 90) / 8));
  return rise * rise * (3 - 2 * rise);
}

function advanceConstruction(placement: TowerPlacement, delta: number): boolean {
  const target = constructionProgress(placement.construction);
  const remainingBuildTime = ((target - placement.visualProgress) * BUILD_SECONDS) / 100;
  placement.visualProgress = Math.min(target, placement.visualProgress + (delta * 100) / BUILD_SECONDS);
  if (placement.activationPending && placement.visualProgress === 100) {
    placement.activationPending = false;
    placement.activationAge = Math.max(0, delta - remainingBuildTime);
  } else if (placement.construction.completed) {
    placement.activationAge += delta;
  }
  return remainingBuildTime > 0;
}

function crownPulseAge(placement: TowerPlacement, seconds: number): number {
  if (placement.activationAge < 2.5) return placement.activationAge;
  if (placement.design.crown !== "prongs" || seconds < 8) return Infinity;
  return (seconds - 8 + placement.design.phase) % 12;
}
