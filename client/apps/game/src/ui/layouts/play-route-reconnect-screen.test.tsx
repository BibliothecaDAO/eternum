// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayRouteReconnectScreen } from "./play-route-reconnect-screen";

vi.mock("@/ui/modules/boot-loader", () => ({
  BootLoaderShell: ({ detail }: { detail: React.ReactNode }) => <div>{detail}</div>,
}));

const renderReconnectScreen = ({
  reconnectError = null,
  reconnectStatus = "idle",
}: {
  reconnectError?: string | null;
  reconnectStatus?: "idle" | "restoring" | "connecting" | "failed" | "connected";
} = {}): { onReconnect: ReturnType<typeof vi.fn>; onRetry: ReturnType<typeof vi.fn> } => {
  const onReconnect = vi.fn();
  const onRetry = vi.fn();
  const onReturnToDashboard = vi.fn();
  act(() => {
    root.render(
      <PlayRouteReconnectScreen
        onReconnect={onReconnect}
        onRetry={onRetry}
        onReturnToDashboard={onReturnToDashboard}
        reconnectError={reconnectError}
        reconnectStatus={reconnectStatus}
        showRetry={true}
      />,
    );
  });
  return { onReconnect, onRetry };
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

  it("disables only the connection action while its attempt is pending", () => {
    const actions = renderReconnectScreen({ reconnectStatus: "connecting" });

    expect(getButton("Connecting...").disabled).toBe(true);
    expect(getButton("Retry Bootstrap").disabled).toBe(false);
    expect(getButton("Return to Dashboard").disabled).toBe(false);

    act(() => getButton("Retry Bootstrap").click());
    expect(actions.onRetry).toHaveBeenCalledOnce();
  });

  it("shows a normalized failure and retries through the connection action", () => {
    const actions = renderReconnectScreen({
      reconnectError: "user rejected",
      reconnectStatus: "failed",
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("user rejected");
    act(() => getButton("Retry Connection").click());
    expect(actions.onReconnect).toHaveBeenCalledOnce();
  });
});
