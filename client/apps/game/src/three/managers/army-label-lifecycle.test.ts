import { describe, expect, it, vi } from "vitest";

import {
  configureArmyLabelHoverPriority,
  initializeArmyLabelState,
  revealArmyLabelState,
} from "./army-label-lifecycle";

function createLabelStub() {
  return {
    renderOrder: 7,
    parent: null as unknown,
    position: {
      copy: vi.fn(),
      y: 3,
    },
    element: {} as HTMLElement,
    userData: {} as Record<string, unknown>,
  };
}

describe("initializeArmyLabelState", () => {
  it("positions the label above the army and resets pooled label metadata", () => {
    const label = createLabelStub();
    const position = { x: 1, y: 2, z: 3 };

    initializeArmyLabelState({
      label: label as never,
      entityId: 42,
      position,
    });

    expect(label.position.copy).toHaveBeenCalledWith(position);
    expect(label.position.y).toBe(5.1);
    expect(label.userData.entityId).toBe(42);
    expect(label.userData.lastDataKey).toBeNull();
  });
});

describe("configureArmyLabelHoverPriority", () => {
  it("captures the base render order and restores it after hover", () => {
    const label = createLabelStub();
    const element = {} as HTMLElement;
    label.element = element;

    configureArmyLabelHoverPriority(label as never);
    (element.onmouseenter as (() => void) | null)?.();
    expect(label.renderOrder).toBe(Infinity);

    (element.onmouseleave as (() => void) | null)?.();
    expect(label.renderOrder).toBe(7);
    expect(label.userData.baseRenderOrder).toBe(7);
  });
});

describe("revealArmyLabelState", () => {
  it("attaches the label to the labels group and refreshes visible content", () => {
    const label = createLabelStub();
    const add = vi.fn((nextLabel) => {
      label.parent = labelsGroup as never;
      return nextLabel;
    });
    const labelsGroup = { add };
    const renderLabel = vi.fn();
    const army = { entityId: 9 };

    revealArmyLabelState({
      label: label as never,
      labelsGroup: labelsGroup as never,
      army,
      renderLabel,
    });

    expect(add).toHaveBeenCalledWith(label);
    expect(renderLabel).toHaveBeenCalledWith(army);
  });

  it("skips content refresh when the army record is missing", () => {
    const label = createLabelStub();
    const renderLabel = vi.fn();

    revealArmyLabelState({
      label: label as never,
      labelsGroup: { add: vi.fn() } as never,
      army: undefined,
      renderLabel,
    });

    expect(renderLabel).not.toHaveBeenCalled();
  });
});
