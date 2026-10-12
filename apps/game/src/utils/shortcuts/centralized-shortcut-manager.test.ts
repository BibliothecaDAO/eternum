// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { CentralizedShortcutManager } from "./centralized-shortcut-manager";

const press = (key: string) => new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });

afterEach(() => CentralizedShortcutManager.getInstance().destroy());

describe("the map's shortcuts", () => {
  it("run on their key and take it", () => {
    const action = vi.fn();
    CentralizedShortcutManager.getInstance().registerShortcut({ id: "back", key: "Escape", description: "", action });
    const escape = press("Escape");
    document.body.dispatchEvent(escape);
    expect(action).toHaveBeenCalledTimes(1);
    expect(escape.defaultPrevented).toBe(true);
  });

  it("leave a key an open surface already took", () => {
    const action = vi.fn();
    CentralizedShortcutManager.getInstance().registerShortcut({ id: "back", key: "Escape", description: "", action });
    const escape = press("Escape");
    escape.preventDefault();
    document.body.dispatchEvent(escape);
    expect(action).not.toHaveBeenCalled();
  });
});
