import { HexPosition, ID } from "@bibliothecadao/types";
import {
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  Scene,
  Vector3,
} from "three";
import { getRenderBounds } from "../utils/chunk-geometry";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { MANAGER_UNCOMMITTED_CHUNK, isCommittedManagerChunk } from "./manager-update-convergence";
import type { ArrivalGhostClearReason, ArrivalGhostVisualStyle } from "./arrival-ghost-policy";

const ARRIVAL_GHOST_ABSORB_DURATION_S = 0.18;
const ARRIVAL_GHOST_ABSORB_SCALE_REDUCTION = 0.45;
const ARRIVAL_GHOST_SURFACE_Y_OFFSET = 0.15;
const ARRIVAL_GHOST_RENDER_ORDER = 10;
const ARRIVAL_GHOST_IDLE_BOB_AMPLITUDE = 0.035;
const ARRIVAL_GHOST_IDLE_BOB_SPEED = 2.8;
const ARRIVAL_GHOST_IDLE_BREATHE_AMPLITUDE = 0.035;
const ARRIVAL_GHOST_IDLE_BREATHE_SPEED = 2.2;
const ARRIVAL_GHOST_RING_INNER_RADIUS = 0.52;
const ARRIVAL_GHOST_RING_OUTER_RADIUS = 0.82;
const ARRIVAL_GHOST_RING_Y_OFFSET = 0.02;
const ARRIVAL_GHOST_RING_OPACITY = 0.34;
const ARRIVAL_GHOST_RING_PULSE_AMPLITUDE = 0.22;
const ARRIVAL_GHOST_RING_PULSE_SPEED = 2.4;
const ARRIVAL_GHOST_BURST_RING_OPACITY = 0.52;
const ARRIVAL_GHOST_BURST_RING_EXPANSION = 0.95;

export interface ArrivalGhostSpec {
  entityId: ID;
  hexCoords: HexPosition;
  sourceScene: Object3D;
  visualStyle: ArrivalGhostVisualStyle;
}

interface ArrivalGhostState extends ArrivalGhostSpec {
  baseScale: Vector3;
  burstRing: Mesh<RingGeometry, MeshBasicMaterial>;
  container: Group;
  ghostBody: Group;
  idleElapsedS: number;
  ring: Mesh<RingGeometry, MeshBasicMaterial>;
  resolveElapsedS: number;
  resolveRequested: boolean;
}

interface ArrivalGhostManagerOptions {
  chunkStride: number;
  renderChunkSize: { width: number; height: number };
}

export class ArrivalGhostManager {
  private readonly ghosts = new Map<ID, ArrivalGhostState>();
  private currentChunkKey: string | null = MANAGER_UNCOMMITTED_CHUNK;

  constructor(
    private readonly scene: Scene,
    private readonly options: ArrivalGhostManagerOptions,
  ) {}

  public upsertLocalArrivalGhost(input: ArrivalGhostSpec): void {
    this.clearArrivalGhost(input.entityId, "superseded");

    const container = this.buildGhostContainer(input);
    const state: ArrivalGhostState = {
      ...input,
      burstRing: container.getObjectByName("arrival-ghost-burst-ring") as Mesh<RingGeometry, MeshBasicMaterial>,
      baseScale: container.scale.clone(),
      container,
      ghostBody: container.getObjectByName("arrival-ghost-body") as Group,
      idleElapsedS: 0,
      ring: container.getObjectByName("arrival-ghost-ring") as Mesh<RingGeometry, MeshBasicMaterial>,
      resolveElapsedS: 0,
      resolveRequested: false,
    };

    this.ghosts.set(input.entityId, state);
    this.syncGhostVisibility(state);
  }

  public resolveArrivalGhost(entityId: ID): void {
    const ghost = this.ghosts.get(entityId);
    if (!ghost) {
      return;
    }

    ghost.resolveRequested = true;
  }

  public clearArrivalGhost(entityId: ID, _reason: ArrivalGhostClearReason): void {
    const ghost = this.ghosts.get(entityId);
    if (!ghost) {
      return;
    }

    this.scene.remove(ghost.container);
    this.disposeGhostContainer(ghost.container);
    this.ghosts.delete(entityId);
  }

  public hasArrivalGhost(entityId: ID): boolean {
    return this.ghosts.has(entityId);
  }

  public getTrackedEntityIds(): ID[] {
    return Array.from(this.ghosts.keys());
  }

  public update(deltaTime: number): void {
    for (const ghost of this.ghosts.values()) {
      this.syncGhostVisibility(ghost);
      if (!ghost.container.visible) {
        continue;
      }

      if (!ghost.resolveRequested) {
        ghost.idleElapsedS += deltaTime;
        this.applyIdlePresentation(ghost);
        continue;
      }

      ghost.resolveElapsedS += deltaTime;
      const resolveProgress = Math.min(1, ghost.resolveElapsedS / ARRIVAL_GHOST_ABSORB_DURATION_S);
      this.applyResolvePresentation(ghost, resolveProgress);

      if (resolveProgress >= 1) {
        this.clearArrivalGhost(ghost.entityId, "arrived");
      }
    }
  }

  public setCurrentChunk(chunkKey: string | null): void {
    this.currentChunkKey = chunkKey;
    for (const ghost of this.ghosts.values()) {
      this.syncGhostVisibility(ghost);
    }
  }

  public destroy(): void {
    Array.from(this.ghosts.keys()).forEach((entityId) => this.clearArrivalGhost(entityId, "scene_destroyed"));
  }

  private buildGhostContainer(input: ArrivalGhostSpec): Group {
    const container = new Group();
    const worldPosition = getWorldPositionForHex(input.hexCoords);
    const rotationSeed = hashCoordinates(input.hexCoords.col, input.hexCoords.row);
    const rotationIndex = Math.floor(rotationSeed * 6);
    const rotationY = (rotationIndex * Math.PI) / 3;
    const ghostRoot = input.sourceScene.clone(true);
    ghostRoot.name = "arrival-ghost-body";
    const destinationRing = this.createDestinationRing(input.visualStyle);
    const burstRing = this.createBurstRing(input.visualStyle);

    this.applyGhostPresentation(ghostRoot, input.visualStyle);

    container.position.set(
      worldPosition.x,
      worldPosition.y + ARRIVAL_GHOST_SURFACE_Y_OFFSET + input.visualStyle.yOffset,
      worldPosition.z,
    );
    container.rotation.y = rotationY;
    container.scale.multiplyScalar(input.visualStyle.scaleMultiplier);
    container.visible = false;
    container.add(destinationRing);
    container.add(burstRing);
    container.add(ghostRoot);
    this.scene.add(container);

    return container;
  }

  private applyGhostPresentation(root: Object3D, visualStyle: ArrivalGhostVisualStyle): void {
    const ghostTint = new Color(visualStyle.color);

    root.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      child.raycast = () => {};
      child.castShadow = false;
      child.receiveShadow = false;
      child.renderOrder = ARRIVAL_GHOST_RENDER_ORDER;
      child.material = this.cloneGhostMaterial(child.material, ghostTint, visualStyle.opacity);
    });
  }

  private createDestinationRing(visualStyle: ArrivalGhostVisualStyle): Mesh<RingGeometry, MeshBasicMaterial> {
    const material = new MeshBasicMaterial({
      color: new Color(visualStyle.color).lerp(new Color("#b8ffb0"), 0.4),
      depthTest: false,
      depthWrite: false,
      opacity: ARRIVAL_GHOST_RING_OPACITY,
      side: DoubleSide,
      transparent: true,
    });
    material.userData.arrivalGhostMaterial = true;

    const mesh = new Mesh(
      new RingGeometry(ARRIVAL_GHOST_RING_INNER_RADIUS, ARRIVAL_GHOST_RING_OUTER_RADIUS, 48),
      material,
    );
    mesh.name = "arrival-ghost-ring";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -(ARRIVAL_GHOST_SURFACE_Y_OFFSET + visualStyle.yOffset) + ARRIVAL_GHOST_RING_Y_OFFSET;
    mesh.renderOrder = ARRIVAL_GHOST_RENDER_ORDER - 1;
    mesh.raycast = () => {};
    return mesh;
  }

  private createBurstRing(visualStyle: ArrivalGhostVisualStyle): Mesh<RingGeometry, MeshBasicMaterial> {
    const material = new MeshBasicMaterial({
      color: new Color(visualStyle.color).lerp(new Color("#f5ffcf"), 0.45),
      depthTest: false,
      depthWrite: false,
      opacity: 0,
      side: DoubleSide,
      transparent: true,
    });
    material.userData.arrivalGhostMaterial = true;

    const mesh = new Mesh(
      new RingGeometry(ARRIVAL_GHOST_RING_INNER_RADIUS * 0.7, ARRIVAL_GHOST_RING_OUTER_RADIUS * 0.92, 48),
      material,
    );
    mesh.name = "arrival-ghost-burst-ring";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -(ARRIVAL_GHOST_SURFACE_Y_OFFSET + visualStyle.yOffset) + ARRIVAL_GHOST_RING_Y_OFFSET * 1.5;
    mesh.renderOrder = ARRIVAL_GHOST_RENDER_ORDER;
    mesh.raycast = () => {};
    mesh.visible = false;
    return mesh;
  }

  private cloneGhostMaterial(
    material: Material | Material[],
    ghostTint: Color,
    opacity: number,
  ): Material | Material[] {
    if (Array.isArray(material)) {
      return material.map((entry) => this.cloneGhostMaterial(entry, ghostTint, opacity) as Material);
    }

    const cloned = material.clone();
    if (cloned instanceof MeshStandardMaterial || cloned instanceof MeshBasicMaterial) {
      cloned.transparent = true;
      cloned.opacity = opacity;
      cloned.depthWrite = false;
      cloned.color.lerp(ghostTint, 0.6);
    }

    cloned.userData.arrivalGhostMaterial = true;
    return cloned;
  }

  private applyIdlePresentation(ghost: ArrivalGhostState): void {
    const bob = Math.sin(ghost.idleElapsedS * ARRIVAL_GHOST_IDLE_BOB_SPEED) * ARRIVAL_GHOST_IDLE_BOB_AMPLITUDE;
    const breathe =
      1 + Math.sin(ghost.idleElapsedS * ARRIVAL_GHOST_IDLE_BREATHE_SPEED) * ARRIVAL_GHOST_IDLE_BREATHE_AMPLITUDE;
    const ringPulse =
      1 + Math.sin(ghost.idleElapsedS * ARRIVAL_GHOST_RING_PULSE_SPEED) * ARRIVAL_GHOST_RING_PULSE_AMPLITUDE;

    ghost.ghostBody.position.y = bob;
    ghost.container.scale.copy(ghost.baseScale).multiplyScalar(breathe);
    ghost.ring.scale.setScalar(ringPulse);
    ghost.ring.material.opacity = ARRIVAL_GHOST_RING_OPACITY + (ringPulse - 1) * 0.18;
    ghost.burstRing.visible = false;
    ghost.burstRing.material.opacity = 0;
    ghost.burstRing.scale.setScalar(1);
  }

  private syncGhostVisibility(ghost: ArrivalGhostState): void {
    ghost.container.visible = this.isGhostVisibleInCurrentChunk(ghost.hexCoords);
  }

  private isGhostVisibleInCurrentChunk(hexCoords: HexPosition): boolean {
    if (!isCommittedManagerChunk(this.currentChunkKey)) {
      return false;
    }

    const [startRow, startCol] = this.currentChunkKey.split(",").map(Number);
    const bounds = getRenderBounds(startRow, startCol, this.options.renderChunkSize, this.options.chunkStride);

    return (
      hexCoords.col >= bounds.minCol &&
      hexCoords.col <= bounds.maxCol &&
      hexCoords.row >= bounds.minRow &&
      hexCoords.row <= bounds.maxRow
    );
  }

  private applyResolvePresentation(ghost: ArrivalGhostState, resolveProgress: number): void {
    const resolveScale = 1 - ARRIVAL_GHOST_ABSORB_SCALE_REDUCTION * resolveProgress;
    ghost.container.scale.copy(ghost.baseScale).multiplyScalar(resolveScale);
    ghost.ghostBody.position.y = resolveProgress * 0.08;
    ghost.ring.scale.setScalar(1 + resolveProgress * 0.5);
    ghost.ring.material.opacity = ARRIVAL_GHOST_RING_OPACITY * (1 - resolveProgress);
    ghost.burstRing.visible = true;
    ghost.burstRing.scale.setScalar(1 + resolveProgress * ARRIVAL_GHOST_BURST_RING_EXPANSION);
    ghost.burstRing.material.opacity = ARRIVAL_GHOST_BURST_RING_OPACITY * (1 - resolveProgress);

    ghost.container.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial) {
          material.opacity = ghost.visualStyle.opacity * (1 - resolveProgress);
        }
      });
    });
  }

  private disposeGhostContainer(container: Object3D): void {
    container.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.userData.arrivalGhostMaterial) {
          material.dispose();
        }
      });
    });
  }
}
