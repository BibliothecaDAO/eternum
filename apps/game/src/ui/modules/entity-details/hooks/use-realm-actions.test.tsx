import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REALM_ACTION_SUBMIT_TIMEOUT_MESSAGE } from "./realm-action-submit-timeout";
import { useRealmActions } from "./use-realm-actions";

const mocks = vi.hoisted(() => ({
  upgradeRealm: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@bibliothecadao/react", () => ({
  useGame: () => ({
    account: { account: { address: "0xowner" } },
    setup: { systemCalls: { upgrade_realm: mocks.upgradeRealm } },
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
        data-testid="upgrade"
        onClick={() => {
          void actions.fireUpgrade(101).catch(() => undefined);
        }}
      >
        Upgrade
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

  const clickUpgrade = async () => {
    const button = container.querySelector('[data-testid="upgrade"]') as HTMLButtonElement | null;
    if (!button) {
      throw new Error("Could not find upgrade button");
    }

    await act(async () => {
      button.click();
      await flushAsyncWork();
    });
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    mocks.upgradeRealm.mockReset();
    mocks.upgradeRealm.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.toastError.mockReset();

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
    await clickUpgrade();

    expect(mocks.upgradeRealm).toHaveBeenCalledWith(
      expect.objectContaining({
        realm_entity_id: 101,
        signer: { address: "0xowner" },
      }),
    );
    expect(readPending()).toBe("none");
  });

  it("clears pending state when submission does not return a transaction hash", async () => {
    mocks.upgradeRealm.mockReturnValueOnce(new Promise(() => undefined));

    await renderProbe();
    await clickUpgrade();

    expect(readPending()).toBe("101");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await flushAsyncWork();
    });

    expect(readPending()).toBe("none");
    expect(mocks.toastError).toHaveBeenCalledWith(REALM_ACTION_SUBMIT_TIMEOUT_MESSAGE);
  });
});
