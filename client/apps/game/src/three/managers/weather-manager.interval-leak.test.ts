import { Scene, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeatherManager } from "./weather-manager";

describe("WeatherManager interval leak on re-add", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createManager() {
    const rainEffect = {
      setEnabled: () => {},
      setWindFromSystem: () => {},
      setIntensity: () => {},
      update: () => {},
    };
    return new WeatherManager(new Scene(), rainEffect as any);
  }

  function createMockGuiFolder() {
    const controllers: any[] = [];
    const folder: any = {
      add: () => {
        const ctrl = { name: () => ctrl, listen: () => ctrl, onChange: () => ctrl };
        controllers.push(ctrl);
        return ctrl;
      },
      addFolder: () => createMockGuiFolder(),
      close: () => {},
    };
    return folder;
  }

  it("clears previous interval before starting a new one in addGUIControls", () => {
    const manager = createManager();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const folder1 = createMockGuiFolder();
    manager.addGUIControls(folder1);

    // First call should not clear anything (no previous interval)
    const clearCallsAfterFirst = clearIntervalSpy.mock.calls.length;

    const folder2 = createMockGuiFolder();
    manager.addGUIControls(folder2);

    // Second call should have cleared the previous interval
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(clearCallsAfterFirst);

    clearIntervalSpy.mockRestore();
    manager.dispose();
  });

  it("dispose clears the interval", () => {
    const manager = createManager();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    manager.addGUIControls(createMockGuiFolder());
    manager.dispose();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
