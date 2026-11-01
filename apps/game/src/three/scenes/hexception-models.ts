import { Box3, Group, Mesh, type AnimationClip } from "three";

interface BuildingModel {
  model: Group;
  animations: AnimationClip[];
}

/** A building grows and turns about its standing base, independent of the source file's origin. */
export function prepareBuildingModel(source: Group): Group {
  const model = new Group();
  source.position.set(0, 0, 0);
  source.rotation.y = 0;
  const base = new Box3().setFromObject(source, true).min.y;
  if (!Number.isFinite(base)) throw new Error("Cannot place a building without finite geometry");
  source.position.y = -base;
  model.add(source);
  model.rotation.y = Math.PI;
  return model;
}

/**
 * The realm view's building models by path, each loaded the first time a building draws it. Scene-owned sources survive
 * view switches; only pending requests suppress another load.
 */
export class HexceptionModels {
  private readonly models = new Map<string, BuildingModel>();
  private readonly pending = new Map<string, Promise<void>>();
  private disposed = false;

  constructor(
    private readonly load: (path: string) => Promise<BuildingModel>,
    private readonly reconcile: () => void,
  ) {}

  get(path: string): BuildingModel | undefined {
    return this.models.get(path);
  }

  request(path: string): Promise<void> {
    if (this.disposed || this.models.has(path)) return Promise.resolve();
    const pending = this.pending.get(path);
    if (pending) return pending;
    const request = this.load(path)
      .then((model) => {
        if (this.disposed) {
          disposeBuildingModel(model.model);
          return;
        }
        this.models.set(path, model);
        this.reconcile();
      })
      .finally(() => this.pending.delete(path));
    this.pending.set(path, request);
    return request;
  }

  dispose(): void {
    this.disposed = true;
    for (const { model } of this.models.values()) disposeBuildingModel(model);
    this.models.clear();
  }
}

export function disposeBuildingModel(model: Group): void {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
