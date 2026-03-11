// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  const moduleProxy = new Proxy(
    {
      StructureProgress: {
        STAGE_1: 1,
        STAGE_2: 2,
        STAGE_3: 3,
      },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );

  return moduleProxy as Record<string, unknown>;
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  const moduleProxy = new Proxy(
    {
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
      StructureType: { Realm: "Realm", Hyperstructure: "Hyperstructure", Bank: "Bank", FragmentMine: "FragmentMine" },
      ResourcesIds: { StaminaRelic1: 1, Copper: 2, ColdIron: 3 },
      BiomeType: enumProxy,
      BuildingType: enumProxy,
      RealmLevelNames: enumProxy,
      RealmLevels: enumProxy,
      ResourceMiningTypes: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );

  return moduleProxy as Record<string, unknown>;
});

vi.mock("@/three/scenes/worldmap", () => ({ default: class MockWorldmapScene {} }));
vi.mock("@/three/scenes/hexception", () => ({ default: class MockHexceptionScene {} }));
vi.mock("@/three/scenes/hud-scene", () => ({ default: class MockHUDScene {} }));

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

const { default: GameRenderer } = await import("./game-renderer");

function createGameRendererSubject() {
  const subject = Object.create(GameRenderer.prototype) as any;

  const canvasParent = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvasParent.appendChild(canvas);
  document.body.appendChild(canvasParent);

  const memoryStatsElement = document.createElement("div");
  const statsDomElement = document.createElement("div");
  const labelRendererElement = document.createElement("div");
  labelRendererElement.appendChild(document.createElement("span"));
  const statsRecordingIndicator = document.createElement("div");
  const pulseStyle = document.createElement("style");
  pulseStyle.id = "stats-recording-pulse";

  document.body.appendChild(memoryStatsElement);
  document.body.appendChild(statsDomElement);
  document.body.appendChild(statsRecordingIndicator);
  document.body.appendChild(pulseStyle);

  const unsubscribeEnableMapZoom = vi.fn();
  const unsubscribeQualityController = vi.fn();
  const worldmapDestroy = vi.fn();
  const hexceptionDestroy = vi.fn();
  const hudDestroy = vi.fn();
  const controlsDispose = vi.fn();
  const rendererDispose = vi.fn();
  const composerDispose = vi.fn();
  const envDispose = vi.fn();
  const keyHandler = vi.fn();

  subject.isDestroyed = false;
  subject.memoryMonitorTimeoutId = setTimeout(() => {}, 60_000);
  subject.unsubscribeEnableMapZoom = unsubscribeEnableMapZoom;
  subject.unsubscribeQualityController = unsubscribeQualityController;
  subject.cleanupIntervals = [setInterval(() => {}, 60_000), setInterval(() => {}, 60_000)];
  subject.renderer = { domElement: canvas, dispose: rendererDispose };
  subject.composer = { dispose: composerDispose };
  subject.worldmapScene = { destroy: worldmapDestroy };
  subject.hexceptionScene = { destroy: hexceptionDestroy };
  subject.hudScene = { destroy: hudDestroy };
  subject.controls = { dispose: controlsDispose };
  subject.environmentTarget = { dispose: envDispose };
  subject.memoryStatsElement = memoryStatsElement;
  subject.statsDomElement = statsDomElement;
  subject.labelRendererElement = labelRendererElement;
  subject.statsRecordingIndicator = statsRecordingIndicator;
  subject.handleURLChange = vi.fn();
  subject.handleWindowResize = vi.fn();
  subject.handleDocumentFocus = vi.fn();
  subject.handleDocumentBlur = vi.fn();
  subject._statsRecordingKeyHandler = keyHandler;

  return {
    subject,
    canvas,
    unsubscribeEnableMapZoom,
    unsubscribeQualityController,
    worldmapDestroy,
    hexceptionDestroy,
    hudDestroy,
    controlsDispose,
    rendererDispose,
    composerDispose,
    envDispose,
    keyHandler,
  };
}

describe("GameRenderer destroy lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cleans timers, listeners, scenes, and DOM resources on destroy", () => {
    const fixture = createGameRendererSubject();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const removeWindowListenerSpy = vi.spyOn(window, "removeEventListener");
    const removeDocumentListenerSpy = vi.spyOn(document, "removeEventListener");

    fixture.subject.destroy();

    expect(fixture.subject.isDestroyed).toBe(true);
    expect(fixture.unsubscribeEnableMapZoom).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeQualityController).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(fixture.subject.cleanupIntervals).toEqual([]);
    expect(fixture.rendererDispose).toHaveBeenCalledTimes(1);
    expect(fixture.composerDispose).toHaveBeenCalledTimes(1);
    expect(fixture.worldmapDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hexceptionDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hudDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.controlsDispose).toHaveBeenCalledTimes(1);
    expect(fixture.envDispose).toHaveBeenCalledTimes(1);
    expect(fixture.canvas.isConnected).toBe(false);

    expect(removeWindowListenerSpy).toHaveBeenCalledWith("urlChanged", fixture.subject.handleURLChange);
    expect(removeWindowListenerSpy).toHaveBeenCalledWith("popstate", fixture.subject.handleURLChange);
    expect(removeWindowListenerSpy).toHaveBeenCalledWith("resize", fixture.subject.handleWindowResize);
    expect(removeWindowListenerSpy).toHaveBeenCalledWith("keydown", fixture.keyHandler);
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith("focus", fixture.subject.handleDocumentFocus, true);
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith("blur", fixture.subject.handleDocumentBlur, true);

    expect(fixture.subject.memoryStatsElement.isConnected).toBe(false);
    expect(fixture.subject.statsDomElement).toBeUndefined();
    expect(fixture.subject.labelRendererElement.childElementCount).toBe(0);
    expect(document.getElementById("stats-recording-pulse")).toBeNull();
    expect(fixture.subject.statsRecordingIndicator.isConnected).toBe(false);
  });

  it("is idempotent and skips cleanup work after the first destroy call", () => {
    const fixture = createGameRendererSubject();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.subject.destroy();
    fixture.subject.destroy();

    expect(fixture.worldmapDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hexceptionDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hudDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.controlsDispose).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("GameRenderer already destroyed, skipping cleanup");
  });
});
