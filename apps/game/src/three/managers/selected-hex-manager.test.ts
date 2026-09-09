import { describe, expect, it, vi } from "vitest";

import { SelectedHexManager } from "./selected-hex-manager";

describe("SelectedHexManager", () => {
  it("holds the hover outline while a selection exists and releases it on dispose", () => {
    const subject = Object.create(SelectedHexManager.prototype) as SelectedHexManager;
    const outline = { showHover: vi.fn(), hideHover: vi.fn(), update: vi.fn(), dispose: vi.fn() };
    Reflect.set(subject as object, "outline", outline);

    subject.setPosition(3, 4);
    subject.update(0.16);
    subject.resetPosition();
    subject.dispose();

    expect(outline.showHover).toHaveBeenCalledWith(3, 4);
    expect(outline.update).toHaveBeenCalledWith(0.16);
    expect(outline.hideHover).toHaveBeenCalledTimes(1);
    expect(outline.dispose).toHaveBeenCalledTimes(1);
  });
});
