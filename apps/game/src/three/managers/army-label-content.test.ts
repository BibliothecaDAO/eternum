import { describe, expect, it, vi } from "vitest";

import {
  buildArmyLabelLayoutDataKey,
  buildArmyLabelStaminaDataKey,
  syncArmyLabelContentState,
  type ArmyLabelContentFields,
} from "./army-label-content";

function createArmyLabelStub() {
  return {
    visible: true,
    userData: {
      lastDataKey: null as string | null,
      lastLayoutDataKey: null as string | null,
      lastStaminaDataKey: null as string | null,
    },
  };
}

function createArmyLabelData(overrides: Partial<ArmyLabelContentFields> = {}): ArmyLabelContentFields {
  return {
    troopCount: 10,
    currentStamina: 9,
    maxStamina: 100,
    displayStaminaRatio: 0.4,
    battleTimerLeft: 8,
    isMine: true,
    owner: {
      address: 1n,
      ownerName: "Alice",
      guildName: "Guild",
    },
    attackedFromDegrees: 45,
    attackedTowardDegrees: 90,
    ...overrides,
  } as ArmyLabelContentFields;
}

describe("army label data keys", () => {
  it("separates layout fields from stamina fields", () => {
    expect(buildArmyLabelLayoutDataKey(createArmyLabelData())).toBe("10-8-true-Alice-45-90");
    expect(buildArmyLabelStaminaDataKey(createArmyLabelData())).toBe("9-100");
  });

  it("ignores projected-only stamina changes so computed labels do not rerender every second", () => {
    const initialKey = buildArmyLabelStaminaDataKey(createArmyLabelData({ displayStaminaRatio: 0.4 }));
    const nextKey = buildArmyLabelStaminaDataKey(createArmyLabelData({ displayStaminaRatio: 0.4002 }));

    expect(nextKey).toBe(initialKey);
  });
});

describe("syncArmyLabelContentState", () => {
  it("skips DOM work when a visible label already matches the current data", () => {
    const label = createArmyLabelStub();
    label.userData.lastLayoutDataKey = buildArmyLabelLayoutDataKey(createArmyLabelData());
    label.userData.lastStaminaDataKey = buildArmyLabelStaminaDataKey(createArmyLabelData());
    const renderLabel = vi.fn();
    const renderStamina = vi.fn();

    syncArmyLabelContentState({
      label: label as never,
      layoutDataKey: buildArmyLabelLayoutDataKey(createArmyLabelData()),
      staminaDataKey: buildArmyLabelStaminaDataKey(createArmyLabelData()),
      labelsAttachedToScene: true,
      renderLabel,
      renderStamina,
    });

    expect(renderLabel).not.toHaveBeenCalled();
    expect(renderStamina).not.toHaveBeenCalled();
  });

  it("marks hidden labels dirty so they rerender when visible again", () => {
    const label = createArmyLabelStub();
    label.userData.lastDataKey = "stale";
    label.visible = false;

    syncArmyLabelContentState({
      label: label as never,
      layoutDataKey: buildArmyLabelLayoutDataKey(createArmyLabelData()),
      staminaDataKey: buildArmyLabelStaminaDataKey(createArmyLabelData()),
      labelsAttachedToScene: true,
      renderLabel: vi.fn(),
      renderStamina: vi.fn(),
    });

    expect(label.userData.lastDataKey).toBeNull();
    expect(label.userData.lastLayoutDataKey).toBeNull();
    expect(label.userData.lastStaminaDataKey).toBeNull();
  });

  it("rerenders the full label when visible layout data changes", () => {
    const label = createArmyLabelStub();
    const renderLabel = vi.fn();
    const renderStamina = vi.fn();

    syncArmyLabelContentState({
      label: label as never,
      layoutDataKey: buildArmyLabelLayoutDataKey(createArmyLabelData({ troopCount: 22 })),
      staminaDataKey: buildArmyLabelStaminaDataKey(createArmyLabelData({ troopCount: 22 })),
      labelsAttachedToScene: true,
      renderLabel,
      renderStamina,
    });

    expect(label.userData.lastDataKey).toBe("22-8-true-Alice-45-90|9-100");
    expect(label.userData.lastLayoutDataKey).toBe("22-8-true-Alice-45-90");
    expect(label.userData.lastStaminaDataKey).toBe("9-100");
    expect(renderLabel).toHaveBeenCalledTimes(1);
    expect(renderStamina).not.toHaveBeenCalled();
  });

  it("skips rendering when only projected stamina changes", () => {
    const label = createArmyLabelStub();
    const initialArmy = createArmyLabelData();
    label.userData.lastLayoutDataKey = buildArmyLabelLayoutDataKey(initialArmy);
    label.userData.lastStaminaDataKey = buildArmyLabelStaminaDataKey(initialArmy);
    const renderLabel = vi.fn();
    const renderStamina = vi.fn();

    syncArmyLabelContentState({
      label: label as never,
      layoutDataKey: buildArmyLabelLayoutDataKey(createArmyLabelData({ displayStaminaRatio: 0.4002 })),
      staminaDataKey: buildArmyLabelStaminaDataKey(createArmyLabelData({ displayStaminaRatio: 0.4002 })),
      labelsAttachedToScene: true,
      renderLabel,
      renderStamina,
    });

    expect(renderLabel).not.toHaveBeenCalled();
    expect(renderStamina).not.toHaveBeenCalled();
  });

  it("updates only stamina when visible computed stamina changes", () => {
    const label = createArmyLabelStub();
    const initialArmy = createArmyLabelData();
    label.userData.lastLayoutDataKey = buildArmyLabelLayoutDataKey(initialArmy);
    label.userData.lastStaminaDataKey = buildArmyLabelStaminaDataKey(initialArmy);
    const renderLabel = vi.fn();
    const renderStamina = vi.fn();

    syncArmyLabelContentState({
      label: label as never,
      layoutDataKey: buildArmyLabelLayoutDataKey(createArmyLabelData({ currentStamina: 10 })),
      staminaDataKey: buildArmyLabelStaminaDataKey(createArmyLabelData({ currentStamina: 10 })),
      labelsAttachedToScene: true,
      renderLabel,
      renderStamina,
    });

    expect(label.userData.lastDataKey).toBe("10-8-true-Alice-45-90|10-100");
    expect(label.userData.lastLayoutDataKey).toBe("10-8-true-Alice-45-90");
    expect(label.userData.lastStaminaDataKey).toBe("10-100");
    expect(renderLabel).not.toHaveBeenCalled();
    expect(renderStamina).toHaveBeenCalledTimes(1);
  });
});
