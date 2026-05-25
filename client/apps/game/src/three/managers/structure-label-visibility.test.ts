import { describe, expect, it, vi } from "vitest";

import { removeStructureLabels, syncStructureLabelVisibility } from "./structure-label-visibility";

describe("syncStructureLabelVisibility", () => {
  it("toggles label visibility and refreshes only labels that become visible", () => {
    const hiddenLabel = {
      userData: { entityId: 7, isVisible: false },
      visible: false,
      element: { style: { display: "none" } },
    } as any;
    const stillVisibleLabel = {
      userData: { entityId: 8, isVisible: true },
      visible: true,
      element: { style: { display: "" } },
    } as any;

    const revealLabel = vi.fn();

    syncStructureLabelVisibility({
      labels: [hiddenLabel, stillVisibleLabel],
      setLabelVisible: () => true,
      revealLabel,
    });

    expect(hiddenLabel.userData.isVisible).toBe(true);
    expect(hiddenLabel.visible).toBe(true);
    expect(hiddenLabel.element.style.display).toBe("");
    expect(revealLabel).toHaveBeenCalledTimes(1);
    expect(revealLabel).toHaveBeenCalledWith(7, hiddenLabel);

    expect(stillVisibleLabel.userData.isVisible).toBe(true);
    expect(revealLabel).not.toHaveBeenCalledWith(8, stillVisibleLabel);
  });

  it("hides labels without calling reveal handlers", () => {
    const visibleLabel = {
      userData: { entityId: 9, isVisible: true },
      visible: true,
      element: { style: { display: "" } },
    } as any;
    const revealLabel = vi.fn();

    syncStructureLabelVisibility({
      labels: [visibleLabel],
      setLabelVisible: () => false,
      revealLabel,
    });

    expect(visibleLabel.userData.isVisible).toBe(false);
    expect(visibleLabel.visible).toBe(false);
    expect(visibleLabel.element.style.display).toBe("none");
    expect(revealLabel).not.toHaveBeenCalled();
  });
});

describe("removeStructureLabels", () => {
  it("removes only labels that are not retained", () => {
    const removeEntityIdLabel = vi.fn();

    removeStructureLabels({
      trackedLabelEntityIds: [1, 2, 3],
      shouldRetainLabel: (entityId) => entityId === 2,
      removeEntityIdLabel,
    });

    expect(removeEntityIdLabel).toHaveBeenCalledTimes(2);
    expect(removeEntityIdLabel).toHaveBeenCalledWith(1);
    expect(removeEntityIdLabel).toHaveBeenCalledWith(3);
  });
});
