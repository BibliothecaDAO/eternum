import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal DOM shims for node environment (jsdom has ESM compat issues).
function createMockElement(tag: string) {
  const children: any[] = [];
  const el: any = {
    tagName: tag.toUpperCase(),
    id: "",
    childElementCount: 0,
    children,
    isConnected: true,
    parentNode: null as any,
    parentElement: null as any,
    appendChild(child: any) {
      children.push(child);
      child.parentNode = el;
      child.parentElement = el;
      child.isConnected = true;
      el.childElementCount = children.length;
      return child;
    },
    removeChild(child: any) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      child.parentElement = null;
      child.isConnected = false;
      el.childElementCount = children.length;
      return child;
    },
    replaceChildren() {
      for (const c of [...children]) {
        c.parentNode = null;
        c.parentElement = null;
        c.isConnected = false;
      }
      children.length = 0;
      el.childElementCount = 0;
    },
    remove() {
      if (el.parentNode) el.parentNode.removeChild(el);
      el.isConnected = false;
    },
    innerHTML: "",
  };
  return el;
}

const bodyEl = createMockElement("body");
const mockDocument = {
  body: bodyEl,
  createElement: (tag: string) => createMockElement(tag),
  getElementById: (id: string) => {
    // Search body children
    for (const c of bodyEl.children) {
      if (c.id === id) return c;
    }
    return null;
  },
  removeEventListener: vi.fn(),
};

const mockWindow = {
  innerHeight: 720,
  innerWidth: 1280,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
};

const mockNavigator = {
  getBattery: vi.fn(async () => ({ charging: true })),
  userAgent: "test",
};

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: () => null,
};

vi.stubGlobal("document", mockDocument);
vi.stubGlobal("window", mockWindow);
vi.stubGlobal("navigator", mockNavigator);
vi.stubGlobal("localStorage", mockLocalStorage);
vi.stubGlobal("sessionStorage", mockLocalStorage);
vi.stubGlobal("requestAnimationFrame", (cb: () => void) => setTimeout(cb, 0));
vi.stubGlobal("cancelAnimationFrame", clearTimeout);
vi.stubGlobal(
  "ProgressEvent",
  class {
    constructor(public readonly type: string) {}
  },
);
vi.stubGlobal("matchMedia", () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal(
  "MutationObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
vi.stubGlobal("performance", {
  mark: vi.fn(),
  markResourceTiming: vi.fn(),
  measure: vi.fn(),
  now: () => Date.now(),
});

class MockGUI {
  domElement = createMockElement("div");
  add() {
    return this;
  }
  addFolder() {
    return new MockGUI();
  }
  addColor() {
    return this;
  }
  close() {}
  open() {}
  destroy() {}
  onChange() {
    return this;
  }
  onFinishChange() {
    return this;
  }
  name() {
    return this;
  }
  min() {
    return this;
  }
  max() {
    return this;
  }
  step() {
    return this;
  }
  listen() {
    return this;
  }
  title() {
    return this;
  }
  show() {
    return this;
  }
  hide() {
    return this;
  }
}
vi.mock("lil-gui", () => ({
  default: MockGUI,
  GUI: MockGUI,
}));

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
vi.mock("@/three/scenes/fast-travel", () => ({ default: class MockFastTravelScene {} }));
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: false,
    VITE_PUBLIC_GRAPHICS_DEV: false,
    VITE_PUBLIC_RENDERER_BUILD_MODE: "experimental-webgpu-auto",
  },
}));
vi.mock("@/three/scenes/hexagon-scene", () => ({
  HexagonScene: class MockHexagonScene {},
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
}));

const { default: GameRenderer } = await import("./game-renderer");

function createGameRendererSubject() {
  const subject = Object.create(GameRenderer.prototype) as any;

  const canvasParent = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvasParent.appendChild(canvas);
  document.body.appendChild(canvasParent);

  const unsubscribeQualityController = vi.fn();
  const worldmapDestroy = vi.fn();
  const hexceptionDestroy = vi.fn();
  const hudDestroy = vi.fn();
  const interactionRuntimeDispose = vi.fn();
  const monitoringRuntimeDispose = vi.fn();
  const routeRuntimeDispose = vi.fn();
  const rendererDispose = vi.fn();
  const envDispose = vi.fn();
  const backendDispose = vi.fn(() => {
    rendererDispose();
    envDispose();
  });

  subject.isDestroyed = false;
  subject.unsubscribeQualityController = unsubscribeQualityController;
  subject.cleanupIntervals = [setInterval(() => {}, 60_000), setInterval(() => {}, 60_000)];
  subject.renderer = { domElement: canvas, dispose: rendererDispose };
  subject.backend = { dispose: backendDispose };
  subject.worldmapScene = { destroy: worldmapDestroy };
  subject.hexceptionScene = { destroy: hexceptionDestroy };
  subject.hudScene = { destroy: hudDestroy };
  subject.interactionRuntime = { dispose: interactionRuntimeDispose };
  subject.monitoringRuntime = { dispose: monitoringRuntimeDispose };
  subject.routeRuntime = { dispose: routeRuntimeDispose };
  subject.environmentTarget = { dispose: envDispose };
  subject.guiFolders = [];
  subject.labelRuntime = { dispose: vi.fn() };
  subject.handleWindowResize = vi.fn();

  return {
    subject,
    canvas,
    unsubscribeQualityController,
    worldmapDestroy,
    hexceptionDestroy,
    hudDestroy,
    interactionRuntimeDispose,
    monitoringRuntimeDispose,
    routeRuntimeDispose,
    rendererDispose,
    envDispose,
    backendDispose,
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
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const removeWindowListenerSpy = vi.spyOn(window, "removeEventListener");

    fixture.subject.destroy();

    expect(fixture.subject.isDestroyed).toBe(true);
    expect(fixture.unsubscribeQualityController).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(fixture.subject.cleanupIntervals).toEqual([]);
    expect(fixture.rendererDispose).toHaveBeenCalledTimes(1);
    expect(fixture.worldmapDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hexceptionDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hudDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.interactionRuntimeDispose).toHaveBeenCalledTimes(1);
    expect(fixture.monitoringRuntimeDispose).toHaveBeenCalledTimes(1);
    expect(fixture.routeRuntimeDispose).toHaveBeenCalledTimes(1);
    expect(fixture.envDispose).toHaveBeenCalledTimes(1);
    expect(fixture.canvas.isConnected).toBe(false);

    expect(removeWindowListenerSpy).toHaveBeenCalledWith("resize", fixture.subject.handleWindowResize);

    expect(fixture.subject.labelRuntime.dispose).toHaveBeenCalledTimes(1);
  });

  it("is idempotent and skips cleanup work after the first destroy call", () => {
    const fixture = createGameRendererSubject();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.subject.destroy();
    fixture.subject.destroy();

    expect(fixture.worldmapDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hexceptionDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.hudDestroy).toHaveBeenCalledTimes(1);
    expect(fixture.interactionRuntimeDispose).toHaveBeenCalledTimes(1);
    expect(fixture.monitoringRuntimeDispose).toHaveBeenCalledTimes(1);
    expect(fixture.routeRuntimeDispose).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("GameRenderer already destroyed, skipping cleanup");
  });

  it("cancels transition cleanup during destroy", () => {
    const fixture = createGameRendererSubject();
    const transitionDestroy = vi.fn();
    fixture.subject.transitionManager = { destroy: transitionDestroy };

    fixture.subject.destroy();

    expect(transitionDestroy).toHaveBeenCalledTimes(1);
  });
});

describe("initScene destruction guard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips all setup when destroyed during backend initialization wait", async () => {
    const subject = Object.create(GameRenderer.prototype) as any;
    let resolveBackend!: () => void;
    subject.backendInitializationPromise = new Promise<void>((r) => {
      resolveBackend = r;
    });
    subject.isDestroyed = false;
    subject.setupGUIControls = vi.fn();
    subject.setupListeners = vi.fn();

    const initPromise = subject.initScene();

    // Destroy while backend promise is pending
    subject.isDestroyed = true;
    resolveBackend();
    await initPromise;

    expect(subject.setupGUIControls).not.toHaveBeenCalled();
    expect(subject.setupListeners).not.toHaveBeenCalled();
  });

  it("does not append a canvas after destroy during backend wait", async () => {
    const subject = Object.create(GameRenderer.prototype) as any;
    let resolveBackend!: () => void;
    subject.backendInitializationPromise = new Promise<void>((r) => {
      resolveBackend = r;
    });
    subject.isDestroyed = false;
    subject.setupGUIControls = vi.fn();
    subject.setupListeners = vi.fn();
    subject.renderer = { domElement: document.createElement("canvas") };

    const initPromise = subject.initScene();
    subject.isDestroyed = true;
    resolveBackend();
    await initPromise;

    expect(subject.renderer.domElement.parentElement).toBeNull();
  });

  it("does not register cleanup intervals after destroy during backend wait", async () => {
    const subject = Object.create(GameRenderer.prototype) as any;
    let resolveBackend!: () => void;
    subject.backendInitializationPromise = new Promise<void>((r) => {
      resolveBackend = r;
    });
    subject.isDestroyed = false;
    subject.setupGUIControls = vi.fn();
    subject.setupListeners = vi.fn();
    subject.cleanupIntervals = [];

    const initPromise = subject.initScene();
    subject.isDestroyed = true;
    resolveBackend();
    await initPromise;

    expect(subject.cleanupIntervals).toEqual([]);
  });

  it("proceeds with normal setup when not destroyed", async () => {
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.backendInitializationPromise = Promise.resolve();
    subject.isDestroyed = false;
    subject.setupGUIControls = vi.fn();
    subject.setupListeners = vi.fn();
    subject.camera = {};
    subject.graphicsSetting = "HIGH";
    subject.cleanupIntervals = [];
    subject.renderer = {
      domElement: document.createElement("canvas"),
      compileAsync: vi.fn(),
    };

    // Stub out the downstream calls that initScene makes
    const origInitScene = GameRenderer.prototype.initScene;
    // We just verify setupGUIControls and setupListeners are called
    // by letting it run until it hits the first thing that would throw
    try {
      await subject.initScene();
    } catch {
      // Expected: will fail on MapControls or other deps, but setup fns should have been called
    }

    expect(subject.setupGUIControls).toHaveBeenCalledTimes(1);
    expect(subject.setupListeners).toHaveBeenCalledTimes(1);
  });
});
