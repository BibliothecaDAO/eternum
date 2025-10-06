import { Scene, Object3D } from "three";
import { CosmeticAttachmentTemplate } from "./types";

interface AttachmentHandle {
  id: string;
  object: Object3D;
}

/**
 * Tracks attachment meshes for cosmetic effects. Real implementations arrive in later phases.
 */
export class CosmeticAttachmentManager {
  private scene: Scene;
  private attachments = new Map<number, AttachmentHandle[]>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  spawnAttachments(entityId: number, templates: CosmeticAttachmentTemplate[]) {
    if (templates.length === 0) return;
    const handles: AttachmentHandle[] = templates.map((template) => ({
      id: template.id,
      object: new Object3D(),
    }));
    handles.forEach((handle) => this.scene.add(handle.object));
    this.attachments.set(entityId, handles);
  }

  removeAttachments(entityId: number) {
    const handles = this.attachments.get(entityId);
    if (!handles) return;
    handles.forEach((handle) => {
      this.scene.remove(handle.object);
    });
    this.attachments.delete(entityId);
  }

  clear() {
    this.attachments.forEach((handles) => {
      handles.forEach((handle) => this.scene.remove(handle.object));
    });
    this.attachments.clear();
  }
}
