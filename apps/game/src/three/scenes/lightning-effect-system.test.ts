import { describe, it, expect, vi, beforeEach } from "vitest";
import { LightningEffectSystem, type LightningEffectDeps } from "./lightning-effect-system";

function createMockDeps(): LightningEffectDeps {
  return {
    scene: {
      add: vi.fn(),
      remove: vi.fn(),
    } as any,
    mainDirectionalLight: {
      intensity: 2.0,
      color: { getHex: () => 0x9966ff, setHex: vi.fn() },
    } as any,
    thunderBoltManager: {
      spawnThunderBolts: vi.fn(),
      cleanup: vi.fn(),
    } as any,
  };
}

describe("LightningEffectSystem", () => {
  let system: LightningEffectSystem;
  let deps: LightningEffectDeps;

  beforeEach(() => {
    vi.restoreAllMocks();
    deps = createMockDeps();
    system = new LightningEffectSystem(deps);
  });

  it("setup creates storm and ambient lights and adds them to scene", () => {
    system.setup();
    expect(deps.scene.add).toHaveBeenCalledTimes(2);
    expect(system.getStormLight()).toBeDefined();
    expect(system.getAmbientPurpleLight()).toBeDefined();
  });

  it("isLightningActive is false initially", () => {
    system.setup();
    expect(system.isLightningActive).toBe(false);
  });

  it("update positions storm light at camera target", () => {
    system.setup();
    system.update({
      cycleProgress: 50,
      cameraTargetX: 10,
      cameraTargetY: 5,
      cameraTargetZ: -3,
      elapsedTime: 1.0,
      stormDepth: 0.5,
    });
    const stormLight = system.getStormLight();
    expect(stormLight.position.x).toBe(10);
    expect(stormLight.position.y).toBe(30); // cameraTargetY + 25
    expect(stormLight.position.z).toBe(2); // cameraTargetZ + 5
  });

  it("cleanup clears timeouts and calls thunderBoltManager.cleanup", () => {
    system.setup();
    system.cleanup();
    expect(deps.thunderBoltManager.cleanup).toHaveBeenCalledTimes(1);
  });

  it("dispose removes lights from scene", () => {
    system.setup();
    system.dispose();
    expect(deps.scene.remove).toHaveBeenCalledTimes(2);
    expect(deps.thunderBoltManager.cleanup).toHaveBeenCalledTimes(1);
  });
});
