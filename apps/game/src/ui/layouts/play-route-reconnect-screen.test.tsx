// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayRouteReconnectScreen } from "./play-route-reconnect-screen";

vi.mock("@/ui/modules/boot-loader", () => ({
  BootLoaderShell: ({ title, detail }: { title: string; detail: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {detail}
    </div>
  ),
}));

vi.mock("@/ui/modules/identity/identity-login", () => ({
  IdentityLogin: () => <div data-testid="identity-login">identity login</div>,
}));

const renderReconnectScreen = ({
  reconnectError = null,
  showRetry = true,
}: { reconnectError?: string | null; showRetry?: boolean } = {}) => {
  const onRetry = vi.fn();
  const onReturnToDashboard = vi.fn();
  act(() => {
    root.render(
      <PlayRouteReconnectScreen
        onRetry={onRetry}
        onReturnToDashboard={onReturnToDashboard}
        reconnectError={reconnectError}
        showRetry={showRetry}
      />,
    );
  });
  return { onRetry, onReturnToDashboard };
};

let container: HTMLDivElement;
let root: Root;

const getButton = (label: string): HTMLButtonElement => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
};

describe("PlayRouteReconnectScreen", () => {
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

  it("signs in on the route itself, with retry and the dashboard as the other ways out", () => {
    const actions = renderReconnectScreen();

    expect(container.textContent).toContain("Sign in to Continue");
    expect(container.querySelector('[data-testid="identity-login"]')).not.toBeNull();

    act(() => getButton("Retry Bootstrap").click());
    expect(actions.onRetry).toHaveBeenCalledOnce();
    act(() => getButton("Return to Dashboard").click());
    expect(actions.onReturnToDashboard).toHaveBeenCalledOnce();
  });

  it("shows the provisioning failure and hides retry when bootstrap did not fail", () => {
    renderReconnectScreen({ reconnectError: "account class is not declared", showRetry: false });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("account class is not declared");
    expect([...container.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Return to Dashboard",
    ]);
  });
});
