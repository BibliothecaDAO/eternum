import { afterEach, describe, expect, it, vi } from "vitest";
import { MeshBasicMaterial, MeshStandardMaterial } from "three";
import { createPooledInstancedMaterial, releasePooledInstancedMaterial } from "./army-model-materials";
import { MaterialPool } from "../utils/material-pool";

describe("army model materials", () => {
  afterEach(() => {
    MaterialPool.getInstance().dispose();
  });

  it("preserves multi-material meshes instead of collapsing to the first material", () => {
    const standMaterial = new MeshStandardMaterial({ opacity: 1 });
    standMaterial.name = "stand-primary";
    const accentMaterial = new MeshBasicMaterial({ opacity: 0.5 });
    accentMaterial.name = "accent";

    const { material, usesInstanceColor } = createPooledInstancedMaterial([standMaterial, accentMaterial]);

    expect(Array.isArray(material)).toBe(true);
    expect(material).toHaveLength(2);
    expect(usesInstanceColor).toBe(true);
  });

  it("releases every pooled material reference on cleanup", () => {
    const first = new MeshStandardMaterial({ opacity: 1 });
    const second = new MeshBasicMaterial({ opacity: 0.5 });
    const releaseSpy = vi.spyOn(MaterialPool.getInstance(), "releaseMaterial");
    const { material } = createPooledInstancedMaterial([first, second]);

    releasePooledInstancedMaterial(material);

    expect(releaseSpy).toHaveBeenCalledTimes(2);
  });
});
