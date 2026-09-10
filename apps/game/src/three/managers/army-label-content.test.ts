import { describe, expect, it, vi } from "vitest";

import { buildArmyLabelDataKey, syncArmyLabelContentState, type ArmyLabelContentFields } from "./army-label-content";

function createArmyLabelStub() {
  return { visible: true, userData: { lastDataKey: null as string | null } };
}

function createArmyLabelData(overrides: Partial<ArmyLabelContentFields> = {}): ArmyLabelContentFields {
  return {
    troopCount: 10,
    battleTimerLeft: 8,
    isMine: true,
    owner: { address: 1n, ownerName: "Alice", guildName: "Guild" },
    attackedFromDegrees: 45,
    attackedTowardDegrees: 90,
    ...overrides,
  };
}

describe("army label data key", () => {
  it("covers every field the label renders", () => {
    expect(buildArmyLabelDataKey(createArmyLabelData())).toBe("10-8-true-Alice-45-90");
  });
});

describe("syncArmyLabelContentState", () => {
  it("skips DOM work when a visible label already matches the current data", () => {
    const label = createArmyLabelStub();
    label.userData.lastDataKey = buildArmyLabelDataKey(createArmyLabelData());
    const renderLabel = vi.fn();

    syncArmyLabelContentState({
      label,
      dataKey: buildArmyLabelDataKey(createArmyLabelData()),
      labelsAttachedToScene: true,
      renderLabel,
    });

    expect(renderLabel).not.toHaveBeenCalled();
  });

  it("marks hidden labels dirty so they rerender when visible again", () => {
    const label = createArmyLabelStub();
    label.userData.lastDataKey = "stale";
    label.visible = false;

    syncArmyLabelContentState({
      label,
      dataKey: buildArmyLabelDataKey(createArmyLabelData()),
      labelsAttachedToScene: true,
      renderLabel: vi.fn(),
    });

    expect(label.userData.lastDataKey).toBeNull();
  });

  it("rerenders the label when visible data changes", () => {
    const label = createArmyLabelStub();
    const renderLabel = vi.fn();

    syncArmyLabelContentState({
      label,
      dataKey: buildArmyLabelDataKey(createArmyLabelData({ troopCount: 22 })),
      labelsAttachedToScene: true,
      renderLabel,
    });

    expect(label.userData.lastDataKey).toBe("22-8-true-Alice-45-90");
    expect(renderLabel).toHaveBeenCalledTimes(1);
  });
});
