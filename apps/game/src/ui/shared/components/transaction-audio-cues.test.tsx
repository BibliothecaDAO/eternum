import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionAudioCues } from "./transaction-audio-cues";

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

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: playMock,
    }),
  },
}));

describe("TransactionAudioCues", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    provider.removeAllListeners();
    playMock.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    provider.removeAllListeners();
    container.remove();
    vi.restoreAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows explicit uncertainty guidance for no-hash submit timeouts", async () => {
    await act(async () => {
      root.render(<TransactionAudioCues />);
    });

    await act(async () => {
      provider.emit("transactionFailed", {
        message: "Transaction submission timed out after 20s before a transaction hash was returned",
        stage: "submit",
        type: "claim_share_points",
        failureKind: "submission_timeout_no_hash",
      });
    });

    expect(playMock).toHaveBeenCalledWith("ui.tx_fail");
  });

  it("surfaces the classified Cairo reason on reverts", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      root.render(<TransactionAudioCues />);
    });

    await act(async () => {
      provider.emit("transactionFailed", {
        message: "Transaction failed to submit: Unknown error",
        stage: "submit",
        type: "explore",
        error: {
          message: "Transaction execution error",
          data: {
            execution_error:
              "Execution failed. Failure reason: 0x6e6f7420656e6f756768207374616d696e61 ('not enough stamina').",
          },
        },
      });
    });

    expect(consoleError).toHaveBeenCalledWith("Transaction failed: not enough stamina");
    expect(playMock).toHaveBeenCalledWith("ui.tx_fail");
  });

  it("prefers the raw receipt revert reason over the regex-salvaged message", async () => {
    await act(async () => {
      root.render(<TransactionAudioCues />);
    });

    await act(async () => {
      provider.emit("transactionFailed", {
        message: "Unknown revert reason",
        stage: "revert",
        type: "explore",
        transactionHash: "0xdead",
        error: new Error("Transaction failed with reason: ENTRYPOINT_FAILED"),
        revertReason:
          "Execution failed. Failure reason: 0x506f70756c6174696f6e2065786365656473206361706163697479 ('Population exceeds capacity').",
      });
    });

    expect(playMock).toHaveBeenCalledWith("ui.tx_fail");
  });
});
