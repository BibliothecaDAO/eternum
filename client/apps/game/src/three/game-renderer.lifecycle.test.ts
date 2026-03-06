// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pmremInstances: Array<{
  compileEquirectangularShader: ReturnType<typeof vi.fn>;
  fromScene: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];
const pmremFallbackTargets: any[] = [];

class FakeElement {
  id = "";
  parentElement: FakeElement | null = null;
  parentNode: FakeElement | null = null;
  style: Record<string, string> = {};
  private children: FakeElement[] = [];
  private connected = false;

  constructor(public readonly tagName: string) {}

  get childElementCount() {
    return this.children.length;
  }

  get isConnected() {
    return this.connected;
  }

  set innerHTML(_value: string) {
    this.replaceChildren();
  }

  appendChild(child: FakeElement) {
    child.parentElement = this;
    child.parentNode = this;
    child.setConnected(this.connected);
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement) {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parentElement = null;
    child.parentNode = null;
    child.setConnected(false);
    return child;
  }

  replaceChildren(...nextChildren: FakeElement[]) {
    for (const child of this.children) {
      child.parentElement = null;
      child.parentNode = null;
      child.setConnected(false);
    }

    this.children = [];
    for (const child of nextChildren) {
      this.appendChild(child);
    }
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  findById(id: string): FakeElement | null {
    if (this.id === id) {
      return this;
    }

    for (const child of this.children) {
      const match = child.findById(id);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private setConnected(isConnected: boolean) {
    this.connected = isConnected;
    for (const child of this.children) {
      child.setConnected(isConnected);
    }
  }
}

const documentBody = new FakeElement("body");
const documentHead = new FakeElement("head");
(documentBody as any).connected = true;
(documentHead as any).connected = true;

const documentStub = {
  body: documentBody,
  head: documentHead,
  createElement: (tagName: string) => new FakeElement(tagName),
  getElementById: (id: string) => documentBody.findById(id) ?? documentHead.findById(id),
  addEventListener: () => {},
  removeEventListener: () => {},
};

const windowStub = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  location: { href: "https://example.test/" },
  addEventListener: () => {},
  removeEventListener: () => {},
};

const localStorageStub = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
})();

Object.assign(globalThis, {
  document: documentStub,
  window: windowStub,
  localStorage: localStorageStub,
  navigator: {
    userAgent: "node-test",
  },
  HTMLInputElement: class HTMLInputElement {},
});

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
vi.mock("@/three/scenes/hexagon-scene", () => ({ CameraView: {} }));
vi.mock("@/services/api", () => ({ sqlApi: {} }));
vi.mock("@/three/utils/", () => ({
  GUIManager: {
    addFolder: () => ({
      add: () => ({ name: () => ({ onChange: () => undefined }) }),
      close: () => undefined,
    }),
  },
  transitionDB: {},
}));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  class MockPMREMGenerator {
    compileEquirectangularShader = vi.fn();
    fromScene = vi.fn(() => pmremFallbackTargets.shift());
    dispose = vi.fn();

    constructor() {
      pmremInstances.push(this);
    }
  }

  return {
    ...actual,
    PMREMGenerator: MockPMREMGenerator,
  };
});

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

const { default: GameRenderer } = await import("./game-renderer");

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

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
  subject.environmentLoadToken = 0;
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
    pmremInstances.length = 0;
    pmremFallbackTargets.length = 0;
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

  it("ignores late environment application after destroy", async () => {
    const fixture = createGameRendererSubject();
    const fallbackTarget = { texture: { id: "fallback" }, dispose: vi.fn() } as any;
    const loadedTarget = { texture: { id: "loaded" }, dispose: vi.fn() } as any;
    const environmentPromise = createDeferredPromise<any>();

    fixture.subject.hexceptionScene = { setEnvironment: vi.fn() };
    fixture.subject.worldmapScene = { setEnvironment: vi.fn() };
    fixture.subject.loadCachedEnvironmentMap = vi.fn(() => environmentPromise.promise);
    pmremFallbackTargets.push(fallbackTarget);

    fixture.subject.applyEnvironment();
    expect(pmremInstances).toHaveLength(1);

    fixture.subject.destroy();
    environmentPromise.resolve(loadedTarget);
    await environmentPromise.promise;
    await Promise.resolve();

    expect(fixture.subject.hexceptionScene.setEnvironment).not.toHaveBeenCalledWith(loadedTarget.texture, 0.1);
    expect(fixture.subject.worldmapScene.setEnvironment).not.toHaveBeenCalledWith(loadedTarget.texture, 0.1);
    expect(fixture.subject.environmentTarget).toBeUndefined();
  });

  it("ignores stale environment completions after a newer load starts", async () => {
    const fixture = createGameRendererSubject();
    const fallbackTargetOne = { texture: { id: "fallback-1" }, dispose: vi.fn() } as any;
    const fallbackTargetTwo = { texture: { id: "fallback-2" }, dispose: vi.fn() } as any;
    const staleTarget = { texture: { id: "stale" }, dispose: vi.fn() } as any;
    const latestTarget = { texture: { id: "latest" }, dispose: vi.fn() } as any;
    const firstDeferred = createDeferredPromise<any>();
    const secondDeferred = createDeferredPromise<any>();

    fixture.subject.hexceptionScene = { setEnvironment: vi.fn() };
    fixture.subject.worldmapScene = { setEnvironment: vi.fn() };
    fixture.subject.loadCachedEnvironmentMap = vi
      .fn()
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);
    pmremFallbackTargets.push(fallbackTargetOne, fallbackTargetTwo);

    fixture.subject.applyEnvironment();
    expect(pmremInstances).toHaveLength(1);

    fixture.subject.applyEnvironment();
    expect(pmremInstances).toHaveLength(2);

    secondDeferred.resolve(latestTarget);
    await secondDeferred.promise;
    await Promise.resolve();

    firstDeferred.resolve(staleTarget);
    await firstDeferred.promise;
    await Promise.resolve();

    expect(fixture.subject.environmentTarget).toBe(latestTarget);
    expect(fixture.subject.hexceptionScene.setEnvironment).not.toHaveBeenCalledWith(staleTarget.texture, 0.1);
    expect(fixture.subject.worldmapScene.setEnvironment).not.toHaveBeenCalledWith(staleTarget.texture, 0.1);
  });
});
