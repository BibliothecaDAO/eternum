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

  it("leave Enter and Space to a focused button, link or tab, which they press, and take every other key there", () => {
    const pressed = vi.fn();
    const lettered = vi.fn();
    const manager = CentralizedShortcutManager.getInstance();
    manager.registerShortcut({ id: "chat", key: "Enter", description: "", action: pressed });
    manager.registerShortcut({ id: "step", key: " ", description: "", action: pressed });
    manager.registerShortcut({ id: "build", key: "b", description: "", action: lettered });
    const controls = ['<button type="button"></button>', '<a href="#"></a>', '<div role="tab" tabindex="0"></div>'];
    const taken = controls.flatMap((html) => {
      document.body.innerHTML = html;
      return ["Enter", " ", "b"].map((key) => {
        const event = press(key);
        document.body.firstElementChild!.dispatchEvent(event);
        return event.defaultPrevented;
      });
    });
    document.body.innerHTML = "";
    expect(pressed).not.toHaveBeenCalled();
    expect(lettered).toHaveBeenCalledTimes(3);
    expect(taken).toEqual([false, false, true, false, false, true, false, false, true]);
  });

  it("leave every key typed into a field", () => {
    const action = vi.fn();
    CentralizedShortcutManager.getInstance().registerShortcut({ id: "build", key: "b", description: "", action });
    document.body.innerHTML = '<input /><textarea></textarea><div contenteditable="true"></div>';
    for (const field of document.body.children) field.dispatchEvent(press("b"));
    document.body.innerHTML = "";
    expect(action).not.toHaveBeenCalled();
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
