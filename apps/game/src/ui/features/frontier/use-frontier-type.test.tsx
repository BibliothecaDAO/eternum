import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useFrontierType } from "./use-frontier-type";

const Surface = () => {
  useFrontierType();
  return null;
};

describe("the player app's visual system", () => {
  it("stays on while any surface holds it, and goes when the last one unmounts", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const doorway = createRoot(document.createElement("div"));
    const hud = createRoot(document.createElement("div"));
    const held = () => document.documentElement.classList.contains("frontier-type");

    act(() => doorway.render(<Surface />));
    act(() => hud.render(<Surface />));
    // The doorway leaves after the HUD has mounted; the HUD keeps the type.
    act(() => doorway.unmount());
    expect(held()).toBe(true);
    act(() => hud.unmount());
    expect(held()).toBe(false);
  });
});
