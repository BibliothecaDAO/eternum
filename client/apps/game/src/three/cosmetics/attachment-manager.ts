import { Euler, Mesh, Object3D, Scene, Vector3 } from "three";
import { CosmeticAssetHandle, ensureCosmeticAsset, loadCosmeticAsset } from "./asset-cache";
import { getCosmeticRegistry } from "./registry";
import { CosmeticAttachmentTemplate, CosmeticRegistryEntry } from "./types";

interface AttachmentHandle {
  id: string;
  object: Object3D;
  template: CosmeticAttachmentTemplate;
}

interface AttachmentSource {
  entry: CosmeticRegistryEntry;
  template: CosmeticAttachmentTemplate;
  assetIndex?: number;
}

interface AttachmentTemplatePool {
  templateId: string;
  source?: AttachmentSource;
  free: Object3D[];
  inUse: Set<Object3D>;
}

const DEFAULT_SCALE = 1;

const normalizeAssetPath = (path?: string): string | undefined => {
  if (!path) return undefined;
  if (path.startsWith("/") || path.startsWith("models/")) {
    return path;
  }
  return `models/${path}`;
};

/**
 * Manages pooled Three.js objects for cosmetic attachments (auras, weapons, etc.).
 */
export class CosmeticAttachmentManager {
  private readonly scene: Scene;
  private readonly attachments = new Map<number, AttachmentHandle[]>();
  private readonly templatePools = new Map<string, AttachmentTemplatePool>();
  private readonly templateSources = new Map<string, AttachmentSource>();
  private readonly warnedMissing = new Set<string>();
  private readonly tempOffset = new Vector3();
  private readonly tempRotation = new Euler();

  constructor(scene: Scene) {
    this.scene = scene;
    this.indexRegistryAttachments();
  }

  spawnAttachments(entityId: number, templates: CosmeticAttachmentTemplate[]) {
    // Replace any existing attachments for the entity before spawning new ones.
    this.removeAttachments(entityId);
    if (templates.length === 0) return;

    const handles: AttachmentHandle[] = [];

    templates.forEach((template) => {
      const object = this.acquireAttachmentObject(template);
      if (!object) {
        return;
      }

      const handle: AttachmentHandle = {
        id: template.id,
        object,
        template,
      };

      this.scene.add(object);
      handles.push(handle);
    });

    if (handles.length > 0) {
      this.attachments.set(entityId, handles);
    }
  }

  removeAttachments(entityId: number) {
    const handles = this.attachments.get(entityId);
    if (!handles) return;

    handles.forEach((handle) => this.releaseHandle(handle));
    this.attachments.delete(entityId);
  }

  clear() {
    this.attachments.forEach((handles) => {
      handles.forEach((handle) => this.releaseHandle(handle));
    });
    this.attachments.clear();

    this.templatePools.forEach((pool) => {
      pool.free.length = 0;
      pool.inUse.clear();
    });
  }

  updateAttachmentTransforms(
    entityId: number,
    transform: { position: Vector3; rotation?: Euler; scale?: Vector3 },
  ) {
    const handles = this.attachments.get(entityId);
    if (!handles) return;

    handles.forEach((handle) => {
      const object = handle.object;
      const template = handle.template;
      const source = this.templateSources.get(template.id);
      const canonical = source?.template;

      object.position.copy(transform.position);

      const offset = template.offset ?? canonical?.offset;
      if (offset) {
        this.tempOffset.set(offset[0], offset[1], offset[2]);
        object.position.add(this.tempOffset);
      }

      const baseRotation = transform.rotation;
      const rotation = template.rotation ?? canonical?.rotation;
      if (rotation || baseRotation) {
        this.tempRotation.set(rotation?.[0] ?? 0, rotation?.[1] ?? 0, rotation?.[2] ?? 0);
        if (baseRotation) {
          this.tempRotation.x += baseRotation.x;
          this.tempRotation.y += baseRotation.y;
          this.tempRotation.z += baseRotation.z;
        }
        object.rotation.copy(this.tempRotation);
      }

      const templateScale = template.scale ?? canonical?.scale ?? DEFAULT_SCALE;
      if (transform.scale) {
        object.scale.set(
          transform.scale.x * templateScale,
          transform.scale.y * templateScale,
          transform.scale.z * templateScale,
        );
      } else {
        object.scale.set(templateScale, templateScale, templateScale);
      }
    });
  }

  retainOnly(entityIds: Set<number>) {
    this.attachments.forEach((_handles, entityId) => {
      if (!entityIds.has(entityId)) {
        this.removeAttachments(entityId);
      }
    });
  }

  private acquireAttachmentObject(template: CosmeticAttachmentTemplate): Object3D | undefined {
    const pool = this.getOrCreatePool(template);
    const existing = pool.free.pop();
    let object = existing ?? this.instantiateAttachment(pool, template);

    if (!object) {
      return undefined;
    }

    if (existing && object.userData.cosmeticPlaceholder && pool.source) {
      const handle = ensureCosmeticAsset(pool.source.entry);
      if (handle.status === "ready") {
        const upgraded = this.cloneFromAsset(handle, pool.source.assetIndex);
        if (upgraded) {
          this.disposePlaceholder(object);
          object = upgraded;
        }
      }
    }

    pool.inUse.add(object);
    this.applyTemplateTransform(object, template, pool.source?.template);

    object.visible = true;
    object.userData.cosmeticTemplateId = template.id;
    object.userData.cosmeticSlot = template.slot;
    object.userData.cosmeticMountPoint = template.mountPoint;

    return object;
  }

  private instantiateAttachment(pool: AttachmentTemplatePool, template: CosmeticAttachmentTemplate): Object3D | undefined {
    const source = pool.source;
    if (source) {
      const handle = ensureCosmeticAsset(source.entry);
      if (handle.status === "idle") {
        void loadCosmeticAsset(source.entry).catch((error) => {
          console.warn(`[Cosmetics] Failed to load attachment asset for ${source.entry.id}`, error);
        });
      }

      if (handle.status === "ready") {
        const clone = this.cloneFromAsset(handle, source.assetIndex);
        if (clone) {
          clone.userData.cosmeticPlaceholder = false;
          return clone;
        }
      } else if (!this.warnedMissing.has(template.id)) {
        this.warnedMissing.add(template.id);
        console.warn(
          `[Cosmetics] Attachment asset for template ${template.id} not ready (status: ${handle.status}). Using placeholder until load completes.`,
        );
      }
    }

    const placeholder = new Object3D();
    placeholder.name = `cosmetic-placeholder:${template.id}`;
    placeholder.userData.cosmeticPlaceholder = true;
    return placeholder;
  }

  private cloneFromAsset(handle: CosmeticAssetHandle, assetIndex?: number): Object3D | undefined {
    const index = assetIndex ?? 0;
    const gltf = handle.payload.gltfs[index] ?? handle.payload.gltfs[0];
    if (!gltf) {
      return undefined;
    }

    const clone = gltf.scene.clone(true);
    clone.name = gltf.scene.name || "cosmetic-attachment";
    return clone;
  }

  private releaseHandle(handle: AttachmentHandle) {
    const pool = this.templatePools.get(handle.id);
    const object = handle.object;
    const isPlaceholder = Boolean(object.userData.cosmeticPlaceholder);

    if (pool) {
      pool.inUse.delete(object);
    }

    this.detachAndReset(object);

    if (isPlaceholder) {
      this.disposePlaceholder(object);
      return;
    }

    if (!pool) {
      return;
    }

    pool.free.push(object);
  }

  private detachAndReset(object: Object3D) {
    if (object.parent) {
      object.parent.remove(object);
    } else {
      this.scene.remove(object);
    }

    object.visible = false;
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(DEFAULT_SCALE, DEFAULT_SCALE, DEFAULT_SCALE);
    object.userData.cosmeticTemplateId = undefined;
    object.userData.cosmeticSlot = undefined;
    object.userData.cosmeticMountPoint = undefined;
    object.userData.cosmeticPlaceholder = undefined;
  }

  private disposePlaceholder(object: Object3D) {
    object.traverse((node) => {
      if (node instanceof Mesh) {
        node.geometry?.dispose?.();
      }
    });
  }

  private applyTemplateTransform(
    object: Object3D,
    template: CosmeticAttachmentTemplate,
    canonical?: CosmeticAttachmentTemplate,
  ) {
    const base = canonical ?? template;

    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(DEFAULT_SCALE, DEFAULT_SCALE, DEFAULT_SCALE);

    const offset = template.offset ?? base.offset;
    const rotation = template.rotation ?? base.rotation;
    const scale = template.scale ?? base.scale ?? DEFAULT_SCALE;

    if (offset) {
      object.position.set(offset[0], offset[1], offset[2]);
    }
    if (rotation) {
      object.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
    object.scale.set(scale, scale, scale);
  }

  private getOrCreatePool(template: CosmeticAttachmentTemplate): AttachmentTemplatePool {
    const existing = this.templatePools.get(template.id);
    if (existing) return existing;

    const source = this.templateSources.get(template.id);
    const pool: AttachmentTemplatePool = {
      templateId: template.id,
      source,
      free: [],
      inUse: new Set(),
    };
    this.templatePools.set(template.id, pool);
    return pool;
  }

  private indexRegistryAttachments() {
    const registry = getCosmeticRegistry();
    const duplicates = new Set<string>();

    registry.forEach((entry) => {
      (entry.attachments ?? []).forEach((template) => {
        if (this.templateSources.has(template.id)) {
          duplicates.add(template.id);
          return;
        }

        const assetPath = normalizeAssetPath(template.assetPath);
        let assetIndex: number | undefined;
        if (assetPath) {
          const index = entry.assetPaths.findIndex((path) => path === assetPath);
          if (index >= 0) {
            assetIndex = index;
          }
        }

        this.templateSources.set(template.id, {
          entry,
          template,
          assetIndex,
        });
      });
    });

    if (duplicates.size > 0) {
      console.warn(
        `[Cosmetics] Duplicate attachment template ids detected: ${Array.from(duplicates).join(", ")}. Later entries ignored.`,
      );
    }
  }
}
