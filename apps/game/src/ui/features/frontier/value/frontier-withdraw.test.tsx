// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The real Withdraw sheet and its sending path, through the game's own outcome boundary (untilApplied); the shard's
// answer, the ledger and the identity stand in.
const game = vi.hoisted(() => ({
  withdraw: vi.fn(async () => ({ transaction_hash: "0x123", statusReceipt: "PENDING" })),
  outcome: vi.fn(),
  paymentTransaction: vi.fn(),
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    account: { account: { address: "0x1" } },
    setup: {
      systemCalls: { withdraw_lords: game.withdraw },
      store: {
        get: (model: string) => (model === "GameRegistry" ? { end_at: 100_000 } : { claim_window_seconds: 86_400 }),
      },
    },
  }),
}));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: { user: {} } }) }));
vi.mock("@/hooks/context/payout-wallet", () => ({ payoutAddressOf: () => "0xabc" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 1 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 1 }));
vi.mock("@/shell/value/use-ledger-paused", () => ({ useLedgerPaused: () => false }));
vi.mock("./use-realm-lords", () => ({ useRealmLords: () => 200 }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0xabc" }) }));
vi.mock("@/runtime/l2-rpc", () => ({
  L2_BLOCK_MS: 2_000,
  l2TransactionUrl: (hash: string) => `https://explorer/tx/${hash}`,
}));
vi.mock("@/sync/active-game-client", () => ({ requireActiveGameClient: () => ({ waitForAction: game.outcome }) }));
vi.mock("@/shell/value/ledger", () => ({
  environmentLedger: () => ({
    latestBlock: async () => 10,
    paymentTransaction: game.paymentTransaction,
  }),
}));

const { FrontierWithdraw } = await import("./frontier-withdraw");

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  client.clear();
});

/** The sheet drawn, all 200 LORDS chosen and Withdraw pressed, then the game's answer and the ledger's read let in. */
const withdrawAll = async () => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <FrontierWithdraw realm={{ entity_id: 7n } as never} onClose={() => {}} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Maximum 200"]')!.click());
  await act(async () => withdrawButton()!.click());
  await act(async () => await new Promise((settled) => setTimeout(settled, 20)));
};
const withdrawButton = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Withdraw");
const picker = () => host.querySelector('button[aria-label="Maximum 200"]');

it("follows an applied withdrawal to its payment on Starknet, one read of its claim's payment", async () => {
  game.outcome.mockResolvedValue({ status: "SUCCEEDED" });
  game.paymentTransaction.mockResolvedValue("0xpaid");
  await withdrawAll();

  expect(game.withdraw).toHaveBeenCalledWith(expect.objectContaining({ amount: 200, structureId: 7 }));
  expect(game.outcome).toHaveBeenCalledWith("0x123");
  expect(game.paymentTransaction).toHaveBeenCalledOnce();
  expect(game.paymentTransaction).toHaveBeenCalledWith("0xabc", "0x123", 10);
  expect(host.textContent).toContain("+200");
  expect(picker()).toBeNull();
});

it("reads a claim not paid yet again a block later, and shows the payment in that block", async () => {
  game.outcome.mockResolvedValue({ status: "SUCCEEDED" });
  game.paymentTransaction.mockResolvedValueOnce(null).mockResolvedValue("0xpaid");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <FrontierWithdraw realm={{ entity_id: 7n } as never} onClose={() => {}} />
        </QueryClientProvider>,
      ),
    );
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Maximum 200"]')!.click());
    await act(async () => withdrawButton()!.click());
    await act(async () => await vi.advanceTimersByTimeAsync(0));
    expect(game.paymentTransaction).toHaveBeenCalledOnce();
    expect(host.textContent).not.toContain("+200");

    await act(async () => await vi.advanceTimersByTimeAsync(1_999));
    expect(game.paymentTransaction).toHaveBeenCalledOnce();
    await act(async () => await vi.advanceTimersByTimeAsync(1));
    expect(game.paymentTransaction).toHaveBeenCalledTimes(2);
    // React Query hands its answer to the page on a timer of its own.
    await act(async () => await vi.advanceTimersByTimeAsync(10));
    expect(host.textContent).toContain("+200");
  } finally {
    vi.useRealTimers();
  }
});

it("returns a reverted withdrawal to the amount's choice with the game's reason, and never asks the ledger", async () => {
  game.outcome.mockResolvedValue({ status: "REVERTED", revertReason: "Insufficient LORDS" });
  await withdrawAll();

  expect(game.outcome).toHaveBeenCalledWith("0x123");
  expect(game.paymentTransaction).not.toHaveBeenCalled();
  expect(picker()).not.toBeNull();
  expect(host.textContent).toContain("Insufficient LORDS");
  expect(withdrawButton()!.disabled).toBe(false);
});

it("says a withdrawal with no answer may still apply, sends it no second time, and never asks the ledger", async () => {
  game.outcome.mockRejectedValue(new Error("No answer yet. This action may still apply. You can try another action."));
  await withdrawAll();

  expect(game.withdraw).toHaveBeenCalledOnce();
  expect(game.paymentTransaction).not.toHaveBeenCalled();
  expect(host.textContent).toContain("may still apply");
  expect(picker()).toBeNull();
  expect(withdrawButton()).toBeUndefined();
});

it("sends nothing while the typed amount is cleared, then exactly the amount typed in its place", async () => {
  game.outcome.mockResolvedValue({ status: "SUCCEEDED" });
  game.paymentTransaction.mockResolvedValue("0xpaid");
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <FrontierWithdraw realm={{ entity_id: 7n } as never} onClose={() => {}} />
      </QueryClientProvider>,
    ),
  );
  const amount = host.querySelector<HTMLInputElement>('input[aria-label="LORDS"]')!;
  const type = (text: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(amount, text);
      amount.dispatchEvent(new Event("input", { bubbles: true }));
    });
  type("120");
  type("");
  expect(amount.value).toBe("");
  // Enter in the field (the browser's own submission) and a submit however it comes: neither sends the 120.
  await act(async () => amount.form!.requestSubmit());
  await act(async () => amount.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(game.withdraw).not.toHaveBeenCalled();

  type("80");
  await act(async () => amount.form!.requestSubmit());
  await act(async () => await new Promise((settled) => setTimeout(settled, 20)));
  expect(game.withdraw).toHaveBeenCalledOnce();
  expect(game.withdraw).toHaveBeenCalledWith(expect.objectContaining({ amount: 80, structureId: 7 }));
});
