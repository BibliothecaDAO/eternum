// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../env", () => ({
  env: { VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-auto" },
}));

import { createRendererInitDiagnostics } from "@/three/renderer-backend-v2";
import { resetRendererDiagnostics, syncRendererBackendDiagnostics } from "@/three/renderer-diagnostics";
import { RendererDebugControl } from "./renderer-debug-control";

let container: HTMLDivElement;
let root: Root;

describe("RendererDebugControl", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/play/madara/iron-age/map?spectate=true");
    resetRendererDiagnostics();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    resetRendererDiagnostics();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows the requested and active lanes with the exact fallback reason", () => {
    syncRendererBackendDiagnostics(
      createRendererInitDiagnostics({
        activeMode: "webgl2-fallback",
        buildMode: "webgpu-auto",
        fallbackReason: "webgpu-unavailable",
        requestedMode: "webgpu-auto",
      }),
    );

    act(() => root.render(<RendererDebugControl />));

    expect(container.querySelector('[data-testid="renderer-active-mode"]')?.textContent).toBe("WebGL2");
    expect(container.textContent).toContain("webgpu-unavailable");
    expect(container.querySelector('[aria-label="Reload with WebGPU"]')?.getAttribute("aria-current")).toBe("true");
  });

  it("preserves the anonymous spectator route and enables logs in both reload links", () => {
    act(() => root.render(<RendererDebugControl />));

    const links = [...container.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links).toHaveLength(2);
    for (const link of links) {
      const url = new URL(link.href);
      expect(url.searchParams.get("spectate")).toBe("true");
      expect(url.searchParams.get("logs")).toBe("1");
      expect(url.searchParams.has("rendererMode")).toBe(true);
    }
  });
});
