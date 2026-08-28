import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from "three";

import type { ProceduralBoatBroadsideSide } from "./procedural-boat-broadside-cycle";
import type { ProceduralBoatConfig } from "./procedural-boat-config";
import type { ProceduralBoatMotionPose } from "./procedural-boat-motion";
import {
  QUATERNIUS_PIRATE_SHIP_ASSET,
  QUATERNIUS_PIRATE_SHIP_MUZZLES,
  type LoadedQuaterniusPirateShipAsset,
} from "./quaternius-pirate-ship-assets";

interface MuzzleSocket {
  flash: Mesh;
  marker: Mesh;
  transform: Object3D;
}

export interface ProceduralBoatAvatarStats {
  assetId: string;
  assetLabel: string;
  authoredClipCount: number;
  meshCount: number;
}

export class ProceduralBoatAvatar {
  public readonly group = new Group();

  private readonly visualRoot = new Group();
  private readonly generatedRoot = new Group();
  private readonly markerGeometry = new SphereGeometry(0.035, 8, 6);
  private readonly markerMaterial = new MeshBasicMaterial({ color: 0x58d8ff, depthTest: false });
  private readonly flashGeometry = new SphereGeometry(0.047, 8, 6);
  private readonly flashMaterial = new MeshBasicMaterial({ color: 0xffc766, transparent: true });
  private readonly wakeGeometry = new PlaneGeometry(0.34, 1.55);
  private readonly wakeMaterial = new MeshBasicMaterial({
    color: 0xb8efff,
    depthWrite: false,
    opacity: 0,
    side: DoubleSide,
    transparent: true,
  });
  private readonly pennantGeometry = createPennantGeometry();
  private readonly pennantMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, side: DoubleSide });
  private readonly sockets: Record<ProceduralBoatBroadsideSide, MuzzleSocket[]> = { port: [], starboard: [] };
  private readonly wakes: Mesh[] = [];
  private readonly pennant = new Mesh(this.pennantGeometry, this.pennantMaterial);
  private meshCount = 0;
  private config: ProceduralBoatConfig;
  private disposed = false;

  public constructor(
    private readonly asset: LoadedQuaterniusPirateShipAsset,
    config: ProceduralBoatConfig,
  ) {
    this.config = config;
    this.group.name = "procedural-boat";
    this.visualRoot.name = "procedural-boat-water-motion";
    this.generatedRoot.name = "procedural-boat-generated-features";
    this.alignAsset(asset.scene);
    this.createMuzzleSockets();
    this.createWake();
    this.createPennant();
    this.visualRoot.add(asset.scene, this.generatedRoot);
    this.group.add(this.visualRoot);
    this.applyConfig(config);
  }

  public applyPose(pose: ProceduralBoatMotionPose, side: ProceduralBoatBroadsideSide): void {
    if (this.disposed) return;
    this.visualRoot.position.y = pose.heave + pose.sinkY;
    this.visualRoot.rotation.set(pose.pitchRadians, 0, pose.rollRadians);
    this.wakeMaterial.opacity = 0.48 * pose.wakeStrength;
    this.wakes.forEach((wake, index) => {
      wake.visible = pose.wakeStrength > 0.005;
      wake.scale.set(0.7 + pose.wakeStrength * 0.7, 0.75 + pose.wakeStrength * (1.1 + index * 0.12), 1);
    });
    (Object.keys(this.sockets) as ProceduralBoatBroadsideSide[]).forEach((socketSide) => {
      this.sockets[socketSide].forEach(({ flash }, index) => {
        const stagger = Math.max(0, 1 - index * 0.08);
        const strength = socketSide === side ? pose.muzzleFlash * stagger : 0;
        flash.visible = index < this.config.broadsideCannons && strength > 0.01;
        flash.scale.setScalar(0.5 + strength * 1.2);
      });
    });
    this.pennant.rotation.y = Math.sin(pose.pitchRadians * 3 + pose.rollRadians * 2) * 0.08;
  }

  public updateConfig(config: ProceduralBoatConfig): void {
    if (this.disposed) return;
    this.config = config;
    this.applyConfig(config);
  }

  public writeMuzzleWorldPositions(side: ProceduralBoatBroadsideSide, count: number, out: Vector3[]): void {
    this.group.updateWorldMatrix(true, true);
    const sockets = this.sockets[side];
    const resolvedCount = Math.min(Math.max(1, Math.round(count)), sockets.length);
    out.length = resolvedCount;
    for (let index = 0; index < resolvedCount; index += 1) {
      const target = out[index] ?? new Vector3();
      sockets[index].transform.getWorldPosition(target);
      out[index] = target;
    }
  }

  public getStats(): ProceduralBoatAvatarStats {
    return {
      assetId: QUATERNIUS_PIRATE_SHIP_ASSET.id,
      assetLabel: this.asset.label,
      authoredClipCount: this.asset.animations.length,
      meshCount: this.meshCount,
    };
  }

  public hasFiniteState(): boolean {
    return [
      ...this.group.position.toArray(),
      ...this.group.quaternion.toArray(),
      ...this.visualRoot.position.toArray(),
      ...this.visualRoot.quaternion.toArray(),
    ].every(Number.isFinite);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    this.flashGeometry.dispose();
    this.flashMaterial.dispose();
    this.wakeGeometry.dispose();
    this.wakeMaterial.dispose();
    this.pennantGeometry.dispose();
    this.pennantMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private alignAsset(scene: Group): void {
    scene.name = "quaternius-pirate-ship-large";
    scene.rotation.y = QUATERNIUS_PIRATE_SHIP_ASSET.yawRadians;
    scene.updateWorldMatrix(true, true);
    const sourceBounds = new Box3().setFromObject(scene);
    const sourceSize = sourceBounds.getSize(new Vector3());
    const scale = sourceSize.z > 1e-5 ? QUATERNIUS_PIRATE_SHIP_ASSET.targetLength / sourceSize.z : 1;
    scene.scale.multiplyScalar(scale);
    scene.updateWorldMatrix(true, true);
    const alignedBounds = new Box3().setFromObject(scene);
    const center = alignedBounds.getCenter(new Vector3());
    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= QUATERNIUS_PIRATE_SHIP_ASSET.waterlineY * scale;
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      this.meshCount += 1;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  private createMuzzleSockets(): void {
    (Object.keys(QUATERNIUS_PIRATE_SHIP_MUZZLES) as ProceduralBoatBroadsideSide[]).forEach((side) => {
      QUATERNIUS_PIRATE_SHIP_MUZZLES[side].forEach((position, index) => {
        const transform = new Object3D();
        transform.name = `procedural-boat-${side}-muzzle:${index}`;
        transform.position.fromArray(position);
        const marker = new Mesh(this.markerGeometry, this.markerMaterial);
        const flash = new Mesh(this.flashGeometry, this.flashMaterial);
        marker.name = `${transform.name}:marker`;
        flash.name = `${transform.name}:flash`;
        flash.position.x = side === "port" ? -0.055 : 0.055;
        flash.visible = false;
        transform.add(marker, flash);
        this.generatedRoot.add(transform);
        this.sockets[side].push({ flash, marker, transform });
      });
    });
  }

  private createWake(): void {
    [-0.28, 0.28].forEach((x, index) => {
      const wake = new Mesh(this.wakeGeometry, this.wakeMaterial);
      wake.name = `procedural-boat-wake:${index}`;
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(x, 0.025, -1.72);
      wake.visible = false;
      this.generatedRoot.add(wake);
      this.wakes.push(wake);
    });
  }

  private createPennant(): void {
    this.pennant.name = "procedural-boat-team-pennant";
    this.pennant.position.set(0, 2.08, -0.58);
    this.generatedRoot.add(this.pennant);
  }

  private applyConfig(config: ProceduralBoatConfig): void {
    this.pennantMaterial.color.set(config.primaryColor);
    this.pennant.scale.setScalar(0.82 + config.tier * 0.13);
    (Object.keys(this.sockets) as ProceduralBoatBroadsideSide[]).forEach((side) => {
      this.sockets[side].forEach(({ marker }, index) => {
        marker.visible = config.showSockets && index < config.broadsideCannons;
      });
    });
  }
}

function createPennantGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0.55, -0.14, 0, 0, -0.29, 0], 3));
  geometry.computeVertexNormals();
  return geometry;
}
