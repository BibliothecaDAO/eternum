import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

interface AcquireResult {
  label: CSS2DObject;
  isNew: boolean;
}

/**
 * Simple pool for CSS2DObject labels so we can reuse DOM nodes instead of
 * allocating/discarding on every chunk switch.
 */
export class LabelPool {
  private pool: CSS2DObject[] = [];
  private pooled = new Set<CSS2DObject>();

  acquire(factory: () => CSS2DObject): AcquireResult {
    const existing = this.pool.pop();
    if (existing) {
      this.pooled.delete(existing);
      existing.visible = true;
      return { label: existing, isNew: false };
    }

    const created = factory();
    created.visible = true;
    return { label: created, isNew: true };
  }

  release(label: CSS2DObject) {
    if (this.pooled.has(label)) {
      return; // already pooled
    }

    if (label.parent) {
      label.parent.remove(label);
    }

    const element = label.element;
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }

    label.visible = false;
    this.pool.push(label);
    this.pooled.add(label);
  }

  clear() {
    this.pool.forEach((label) => {
      if (label.parent) {
        label.parent.remove(label);
      }
      const element = label.element;
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.pool.length = 0;
    this.pooled.clear();
  }

  size() {
    return this.pool.length;
  }
}
