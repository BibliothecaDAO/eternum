import * as THREE from "three";
import { MapObject } from "./types";

export abstract class ObjectRenderer<T extends MapObject> {
  protected scene: THREE.Scene;
  protected objects: Map<number, T> = new Map();
  protected selectedObjectId: number | null = null;
  protected visibleBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null = null;

  protected tempVector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public abstract setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void;
  public abstract addObject(object: T): void;
  public abstract removeObject(objectId: number): void;
  public abstract updateObject(object: T): void;
  public abstract updateObjectPosition(objectId: number, col: number, row: number): void;
  public abstract moveObject(objectId: number, targetCol: number, targetRow: number, duration?: number): Promise<void>;
  public abstract moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration?: number,
  ): Promise<void>;
  public abstract isObjectMoving(objectId: number): boolean;
  public abstract getObject(objectId: number): T | undefined;
  public abstract getObjectsAtHex(col: number, row: number): T[];
  public abstract selectObject(objectId: number): void;
  public abstract deselectObject(): void;
  public abstract getSelectedObjectId(): number | null;
  public abstract getAllObjects(): T[];
  public abstract dispose(): void;
}
