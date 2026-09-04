import { Object3D, Scene } from "three";
import { describe, expect, it } from "vitest";

import { CosmeticAttachmentManager } from "./attachment-manager";

describe("CosmeticAttachmentManager slot visibility", () => {
  it("hides procedural-owned props without hiding an unrelated aura", () => {
    const manager = new CosmeticAttachmentManager(new Scene());
    const weapon = new Object3D();
    const quiver = new Object3D();
    const aura = new Object3D();
    (manager as unknown as { attachments: Map<number, unknown[]> }).attachments.set(17, [
      { id: "weapon", object: weapon, template: { id: "weapon", slot: "weapon" } },
      { id: "quiver", object: quiver, template: { id: "quiver", slot: "back" } },
      { id: "aura", object: aura, template: { id: "aura", slot: "aura" } },
    ]);

    manager.setAttachmentSlotsVisible(17, new Set(["back", "offhand", "weapon"]), false);

    expect(weapon.visible).toBe(false);
    expect(quiver.visible).toBe(false);
    expect(aura.visible).toBe(true);

    manager.setAttachmentSlotsVisible(17, new Set(["back", "offhand", "weapon"]), true);
    expect(weapon.visible).toBe(true);
    expect(quiver.visible).toBe(true);
    expect(aura.visible).toBe(true);
  });
});
