import { describe, expect, it, vi } from "vitest";

import {
  clearArmyPointHoverState,
  removeArmyPointIconState,
  resolveArmyPointRendererKey,
  setArmyPointHoverState,
  syncArmyPointIconState,
} from "./army-point-visuals";

function createPointRenderers() {
  return {
    player: {
      setPoint: vi.fn(),
      hasPoint: vi.fn(() => false),
      removePoint: vi.fn(),
      setHover: vi.fn(),
      clearHover: vi.fn(),
    },
    enemy: {
      setPoint: vi.fn(),
      hasPoint: vi.fn(() => false),
      removePoint: vi.fn(),
      setHover: vi.fn(),
      clearHover: vi.fn(),
    },
    ally: {
      setPoint: vi.fn(),
      hasPoint: vi.fn(() => false),
      removePoint: vi.fn(),
      setHover: vi.fn(),
      clearHover: vi.fn(),
    },
    agent: {
      setPoint: vi.fn(),
      hasPoint: vi.fn(() => false),
      removePoint: vi.fn(),
      setHover: vi.fn(),
      clearHover: vi.fn(),
    },
  };
}

describe("resolveArmyPointRendererKey", () => {
  it("prefers the agent renderer for daydream armies", () => {
    expect(resolveArmyPointRendererKey({ isDaydreamsAgent: true, isMine: true })).toBe("agent");
  });

  it("uses the player renderer for owned armies and enemy renderer otherwise", () => {
    expect(resolveArmyPointRendererKey({ isDaydreamsAgent: false, isMine: true })).toBe("player");
    expect(resolveArmyPointRendererKey({ isDaydreamsAgent: false, isMine: false })).toBe("enemy");
  });
});

describe("syncArmyPointIconState", () => {
  it("routes icon updates through the selected renderer", () => {
    const renderers = createPointRenderers();
    const position = { x: 1, y: 2, z: 3 };

    syncArmyPointIconState({
      renderers,
      rendererKey: "player",
      entityId: 7,
      position,
    });

    expect(renderers.player.setPoint).toHaveBeenCalledWith({ entityId: 7, position });
    expect(renderers.enemy.setPoint).not.toHaveBeenCalled();
  });
});

describe("removeArmyPointIconState", () => {
  it("removes the point from any renderer currently tracking the entity", () => {
    const renderers = createPointRenderers();
    renderers.enemy.hasPoint.mockReturnValue(true);
    renderers.agent.hasPoint.mockReturnValue(true);

    removeArmyPointIconState({
      renderers,
      entityId: 11,
    });

    expect(renderers.enemy.removePoint).toHaveBeenCalledWith(11);
    expect(renderers.agent.removePoint).toHaveBeenCalledWith(11);
    expect(renderers.player.removePoint).not.toHaveBeenCalled();
  });
});

describe("point hover helpers", () => {
  it("sets hover on the selected renderer and clears hover across all renderers", () => {
    const renderers = createPointRenderers();

    setArmyPointHoverState({
      renderers,
      rendererKey: "agent",
      entityId: 5,
    });
    clearArmyPointHoverState({ renderers });

    expect(renderers.agent.setHover).toHaveBeenCalledWith(5);
    expect(renderers.player.setHover).not.toHaveBeenCalled();
    expect(renderers.player.clearHover).toHaveBeenCalled();
    expect(renderers.enemy.clearHover).toHaveBeenCalled();
    expect(renderers.ally.clearHover).toHaveBeenCalled();
    expect(renderers.agent.clearHover).toHaveBeenCalled();
  });
});
