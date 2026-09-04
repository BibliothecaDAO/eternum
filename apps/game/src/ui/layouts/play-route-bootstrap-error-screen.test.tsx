// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayRouteBootstrapErrorScreen } from "./play-route-bootstrap-error-screen";

vi.mock("@/ui/modules/boot-loader", () => ({
  BootLoaderShell: ({ title, detail }: { title: string; detail: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {detail}
    </div>
  ),
}));

vi.mock("@/ui/debug/renderer-debug-control", () => ({
  RendererDebugControl: () => <div data-testid="renderer-debug">renderer debug</div>,
}));

let container: HTMLDivElement;
let root: Root;

const getButton = (label: string): HTMLButtonElement => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
};

describe("PlayRouteBootstrapErrorScreen", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("reports the bootstrap failure without presenting a sign-in flow", () => {
    const onRetry = vi.fn();
    const onReturnToDashboard = vi.fn();

    act(() => {
      root.render(
        <PlayRouteBootstrapErrorScreen
          error={new Error("Renderer startup failed")}
          onRetry={onRetry}
          onReturnToDashboard={onReturnToDashboard}
        />,
      );
    });

    expect(container.textContent).toContain("Unable to Start");
    expect(container.textContent).toContain("Renderer startup failed");
    expect(container.textContent).not.toContain("Sign in");
    expect(container.querySelector('[data-testid="renderer-debug"]')).not.toBeNull();

    act(() => getButton("Retry Bootstrap").click());
    expect(onRetry).toHaveBeenCalledOnce();
    act(() => getButton("Return to Dashboard").click());
    expect(onReturnToDashboard).toHaveBeenCalledOnce();
  });
});
