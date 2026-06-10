import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REALM_ACTION_SUBMIT_TIMEOUT_MESSAGE } from "./realm-action-submit-timeout";
import { useRealmActions } from "./use-realm-actions";

const mocks = vi.hoisted(() => ({
  executeObservedClientTransaction: vi.fn(),
  toastError: vi.fn(),
  getContractByName: vi.fn((_manifest: unknown, _namespace: string, contractName: string) => ({
    address: contractName === "blitz_realm_systems" ? "0xblitz" : "0xstructure",
  })),
}));

vi.mock("@/observability/observed-client-transaction", () => ({
  executeObservedClientTransaction: mocks.executeObservedClientTransaction,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@dojoengine/core", () => ({
  getContractByName: mocks.getContractByName,
}));

vi.mock("../../../../../dojo-config", () => ({
  dojoConfig: {
    manifest: {},
  },
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    account: {
      account: {
        address: "0xowner",
      },
    },
  }),
}));

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const HookProbe = () => {
  const actions = useRealmActions();

  return (
    <div>
      <div data-testid="pending">{actions.pendingRealmId ?? "none"}</div>
      <button
        type="button"
        data-testid="provision"
        onClick={() => {
          void actions.fireProvision(101).catch(() => undefined);
        }}
      >
        Provision
      </button>
    </div>
  );
};

describe("useRealmActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderProbe = async () => {
    await act(async () => {
      root.render(<HookProbe />);
      await flushAsyncWork();
    });
  };

  const readPending = () => container.querySelector('[data-testid="pending"]')?.textContent ?? "";

  const clickProvision = async () => {
    const button = container.querySelector('[data-testid="provision"]') as HTMLButtonElement | null;
    if (!button) {
      throw new Error("Could not find provision button");
    }

    await act(async () => {
      button.click();
      await flushAsyncWork();
    });
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.executeObservedClientTransaction.mockReset();
    mocks.executeObservedClientTransaction.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.toastError.mockReset();
    mocks.getContractByName.mockClear();

    vi.useFakeTimers();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flushAsyncWork();
    });

    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("does not keep realm actions pending while waiting for confirmation", async () => {
    await renderProbe();
    await clickProvision();

    expect(mocks.executeObservedClientTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "realm_systems.provision",
        waitForConfirmation: false,
      }),
    );
    expect(readPending()).toBe("none");
  });

  it("clears pending state when submission does not return a transaction hash", async () => {
    mocks.executeObservedClientTransaction.mockReturnValueOnce(new Promise(() => undefined));

    await renderProbe();
    await clickProvision();

    expect(readPending()).toBe("101");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await flushAsyncWork();
    });

    expect(readPending()).toBe("none");
    expect(mocks.toastError).toHaveBeenCalledWith(REALM_ACTION_SUBMIT_TIMEOUT_MESSAGE);
  });
});
