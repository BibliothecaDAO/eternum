import { describe, expect, it } from "vitest";
import { createWorldmapLifecycleFixture } from "./worldmap-lifecycle-fixture";

describe("Worldmap lifecycle baseline", () => {
  it("registers and unregisters urlChanged listener with stable identity across setup/destroy", () => {
    const fixture = createWorldmapLifecycleFixture();

    fixture.setup();
    fixture.destroy();

    expect(fixture.listenerAdds.length).toBe(1);
    expect(fixture.listenerRemoves.length).toBe(1);
    expect(fixture.listenerAdds[0].event).toBe("urlChanged");
    expect(fixture.listenerRemoves[0].event).toBe("urlChanged");
    expect(fixture.listenerRemoves[0].handler).toBe(fixture.listenerAdds[0].handler);
  });

  it("short-circuits updateVisibleChunks when the worldmap scene is switched off", () => {
    const fixture = createWorldmapLifecycleFixture();

    fixture.switchOff();
    const result = fixture.updateVisibleChunks();

    expect(result).toBe(false);
  });

  it("reuses onSwitchOff cleanup from destroy to keep teardown behavior symmetrical", () => {
    const fixture = createWorldmapLifecycleFixture();

    fixture.setup();
    fixture.destroy();

    expect(fixture.switchOffCalls).toBe(1);
    expect(fixture.listenerRemoves.length).toBe(1);
  });

  it("destroys worldmap-owned managers and FX systems during teardown", () => {
    const fixture = createWorldmapLifecycleFixture();

    fixture.setup();
    fixture.destroy();

    expect(fixture.destroyCalls.armyManager).toBe(1);
    expect(fixture.destroyCalls.structureManager).toBe(1);
    expect(fixture.destroyCalls.chestManager).toBe(1);
    expect(fixture.destroyCalls.fxManager).toBe(1);
    expect(fixture.destroyCalls.resourceFXManager).toBe(1);
  });

  it("detaches urlChanged listener when switching off to avoid inactive-scene callbacks", () => {
    const fixture = createWorldmapLifecycleFixture();

    fixture.setup();
    fixture.switchOff();

    expect(fixture.listenerRemoves.length).toBe(1);
    expect(fixture.listenerRemoves[0].event).toBe("urlChanged");
  });

  it("short-circuits requestChunkRefresh when the worldmap scene is switched off", () => {
    const fixture = createWorldmapLifecycleFixture();

    fixture.switchOff();
    fixture.requestChunkRefresh();

    expect(fixture.refreshRequests).toBe(0);
  });
});
