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
    return new WeatherManager({ addGUIControls: vi.fn(), dispose: vi.fn() } as any);
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

  it("does not create polling intervals when adding or replacing debug controls", () => {
    const manager = createManager();
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    manager.addGUIControls(createMockGuiFolder());
    manager.addGUIControls(createMockGuiFolder());
    expect(intervalSpy).not.toHaveBeenCalled();
    manager.dispose();
    intervalSpy.mockRestore();
  });
});
