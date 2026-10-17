import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useDocumentClass } from "./use-document-class";

const Surface = ({ name }: { name: string }) => {
  useDocumentClass(name);
  return null;
};

describe("a surface's class on <html>", () => {
  it("stays on while any surface holds it, and goes when the last one unmounts", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const leaving = createRoot(document.createElement("div"));
    const hud = createRoot(document.createElement("div"));
    const other = createRoot(document.createElement("div"));
    const held = (name: string) => document.documentElement.classList.contains(name);

    act(() => leaving.render(<Surface name="classic-hud" />));
    act(() => hud.render(<Surface name="classic-hud" />));
    act(() => other.render(<Surface name="frontier-type" />));
    // The leaving surface unmounts after the HUD has mounted; the HUD keeps the class.
    act(() => leaving.unmount());
    expect(held("classic-hud")).toBe(true);
    act(() => other.unmount());
    expect(held("frontier-type")).toBe(false);
    expect(held("classic-hud")).toBe(true);
    act(() => hud.unmount());
    expect(held("classic-hud")).toBe(false);
  });
});
