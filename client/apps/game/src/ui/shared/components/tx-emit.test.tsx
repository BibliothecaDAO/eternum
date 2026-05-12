import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionNotification } from "./tx-emit";

const provider = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    emit(event: string, payload: unknown) {
      listeners.get(event)?.forEach((listener) => listener(payload));
    },
    on(event: string, listener: (payload: unknown) => void) {
      const eventListeners = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    },
    off(event: string, listener: (payload: unknown) => void) {
      listeners.get(event)?.delete(listener);
    },
    removeAllListeners() {
      listeners.clear();
    },
  };
});

const toastMock = vi.hoisted(() => vi.fn());
const playMock = vi.hoisted(() => vi.fn());

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    setup: {
      network: {
        provider,
      },
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: playMock,
    }),
  },
}));

describe("TransactionNotification", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    provider.removeAllListeners();
    toastMock.mockClear();
    playMock.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    provider.removeAllListeners();
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows explicit uncertainty guidance for no-hash submit timeouts", async () => {
    await act(async () => {
      root.render(<TransactionNotification />);
    });

    await act(async () => {
      provider.emit("transactionFailed", {
        message: "Transaction submission timed out after 20s before a transaction hash was returned",
        stage: "submit",
        type: "claim_share_points",
        failureKind: "submission_timeout_no_hash",
      });
    });

    expect(toastMock).toHaveBeenCalledWith("⚠️ Transaction status uncertain", {
      description: expect.stringContaining(
        "Submission timed out before a tx hash was returned. Check wallet/activity before retrying.",
      ),
    });
    expect(playMock).toHaveBeenCalledWith("ui.tx_fail");
  });
});
