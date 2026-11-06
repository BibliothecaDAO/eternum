import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { LordsDeposit } from "@realms-world/value-ledger/deposits";
import type { AccountInterface, Call, ProviderInterface } from "starknet";
import { forgetUncertain } from "@/ui/modules/identity/uncertain-sends";
import { sendFromWallet, type WalletSendOutcome } from "@/ui/modules/identity/wallet-send";
import { depositStructure } from "../../../../../../value-relay/test-support/deposit-structure";
import { useDepositPaymentStore } from "@/hooks/store/use-deposit-payment-store";
import { FrontierPurse } from "./frontier-purse";
const wallet = vi.hoisted(() => ({
  refetch: vi.fn(),
  available: 20n,
  history: [] as LordsDeposit[],
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 7 } }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: { user: { realmsId: "0x77" } } }),
}));
vi.mock("@/hooks/context/payout-wallet", () => ({ payoutAddressOf: () => "0x33" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 1000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => {} }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { get: () => ({ start_main_at: 1, end_at: 2000 }) } } }),
}));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x2" }) }));
vi.mock("@/runtime/l2-rpc", () => ({ L2_CHAIN: { id: "0x1" }, L2_BLOCK_MS: 1000 }));
vi.mock("@/shell/value/ledger", () => ({ environmentLedger: () => ({ address: "0x10" }) }));
vi.mock("@/shell/value/use-ledger-paused", () => ({ useLedgerPaused: () => false }));
vi.mock("./use-realm-lords", () => ({ useRealmLords: () => 90 }));
vi.mock("./use-spend-lords", () => ({
  useSpendLords: () => ({
    source: { chain: "0x1", ledger: "0x10" },
    balance: { available: wallet.available, swept: 0n },
    receipts: [],
  }),
}));
vi.mock("./link-wallet", () => ({ useLinkWallet: () => () => {} }));
vi.mock("./frontier-withdraw", () => ({ FrontierWithdraw: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "deposit-token" ? "0x99" : wallet.history,
    refetch: wallet.refetch,
  }),
}));
const realm = depositStructure("0x30");
/** The payment the purse opened on the app sheet, as the payment dialog reads it. */
const paid = () =>
  useDepositPaymentStore.getState().payment as null | {
    calls: (Call & { calldata: string[] })[];
    request: string;
    onLanded: () => void;
  };
/** The open payment closed, as the dialog's Close does. */
const closePayment = () => act(() => useDepositPaymentStore.getState().close(paid()!.request));
/** A payment landed, as the dialog answers it: its own payment closed, then the purse told. */
const landed = (payment: NonNullable<ReturnType<typeof paid>>) =>
  act(() => {
    useDepositPaymentStore.getState().close(payment.request);
    payment.onLanded();
  });
const land = () => landed(paid()!);
beforeEach(() => {
  localStorage.clear();
  useDepositPaymentStore.setState({ payment: null });
  wallet.available = 20n;
  wallet.history = [];
  vi.clearAllMocks();
});
async function render() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<FrontierPurse realm={realm} onClose={() => {}} />));
  return {
    host,
    button: (text: string) => [...host.querySelectorAll("button")].find((button) => button.textContent === text)!,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}
const amount = (host: HTMLElement) =>
  host.querySelector<HTMLInputElement>('input[aria-label="Whole LORDS to deposit"]')!;
const edit = (input: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
it("writes exact held balances and deposit history through the shared number formats", async () => {
  wallet.available = 12_345_678_901_234_567_890n;
  wallet.history = [
    {
      shard: "0x2",
      id: "1",
      gameId: 7,
      games: "0x10",
      account: "0x30",
      realmsId: "0x77",
      home: "1",
      payer: "0x33",
      amount: "12345",
      paidAt: "1000",
      status: "pending",
    },
  ];
  const view = await render();
  expect(view.host.textContent).toContain("Spend-only: 12,345,678,901,234,567,890 LORDS");
  expect(view.host.querySelector("[data-spend-lords]")?.getAttribute("data-spend-lords")).toBe("12345678901234567890");
  expect(view.host.querySelector('[data-deposit-id="1"]')?.textContent).toBe(
    "12.3K LORDS · Payment confirmed · credit pending",
  );
  view.unmount();
});
it("confirms one payment, resets the form and sends a second deposit with a fresh identity", async () => {
  const view = await render();
  expect(amount(view.host).inputMode).toBe("numeric");
  expect(amount(view.host).value).toBe("10");
  await act(async () => view.button("Deposit LORDS").click());
  const first = paid()!.calls[1].calldata.at(-1);
  expect(amount(view.host).disabled).toBe(true);
  land();
  expect(amount(view.host).disabled).toBe(false);
  expect(attempt()).toBeNull();
  expect(view.host.textContent).toContain("Payment confirmed. Waiting for the spend-only credit.");
  edit(amount(view.host), "25");
  await act(async () => view.button("Deposit LORDS").click());
  expect(paid()!.calls[1].calldata.slice(-2)).toEqual(["25", expect.any(String)]);
  expect(paid()!.calls[1].calldata.at(-1)).not.toBe(first);
  expect(view.host.querySelector("[data-spend-lords]")?.getAttribute("data-spend-lords")).toBe("20");
  view.unmount();
});

it("says the network fee is shown before confirming, never that it is paid in STRK", async () => {
  const view = await render();
  expect(view.host.textContent).toContain("The network fee is shown before you confirm.");
  expect(view.host.textContent).not.toContain("STRK");
  view.unmount();
});

/** The saved payment's terms: its amount and request identity, or null once there is none. */
const attempt = () => {
  const key = Object.keys(localStorage).find((name) => name.startsWith("lords-deposit:"));
  return key ? localStorage.getItem(key) : null;
};

/** The purse's calls sent through the one wallet send, its wallet answering `execute` as given. */
async function send(execute: () => Promise<unknown>, receipt: Promise<object> = Promise.resolve({})) {
  const account = {
    address: "0x33",
    estimateInvokeFee: async () => ({ overall_fee: 1n }),
    execute: vi.fn(execute),
  } as unknown as AccountInterface;
  const provider = {
    callContract: async () => ["1", "0"],
    waitForTransaction: vi.fn(() => receipt),
  } as unknown as ProviderInterface;
  const calls = paid()!.calls;
  let outcome: WalletSendOutcome | undefined;
  await act(async () => {
    outcome = await sendFromWallet(account, "0x33", calls, provider, () => {}, new AbortController().signal);
  });
  expect(account.execute).toHaveBeenCalledWith(calls);
  return outcome;
}

async function expectEditable(view: Awaited<ReturnType<typeof render>>, first: unknown) {
  act(() => view.button("Edit or cancel deposit").click());
  expect(attempt()).toBeNull();
  expect(amount(view.host).disabled).toBe(false);
  edit(amount(view.host), "3");
  await act(async () => view.button("Deposit LORDS").click());
  expect(paid()!.calls[1].calldata.at(-2)).toBe("3");
  expect(paid()!.calls[1].calldata.at(-1)).not.toBe(first);
}

it("offers Edit or cancel while nothing has been handed to a wallet", async () => {
  const view = await render();
  try {
    edit(amount(view.host), "25");
    await act(async () => view.button("Deposit LORDS").click());
    expect(amount(view.host).disabled).toBe(true);
    const first = paid()!.calls[1].calldata.at(-1);
    // Open on the app sheet: nothing to retry until it closes.
    expect(view.button("Retry payment")).toBeUndefined();
    closePayment();
    expect(view.button("Retry payment")).toBeDefined();
    await expectEditable(view, first);
  } finally {
    view.unmount();
  }
});

it("lets an earlier payment's late landing neither close nor clear newer terms", async () => {
  const view = await render();
  try {
    await act(async () => view.button("Deposit LORDS").click());
    const earlier = paid()!;
    closePayment();
    act(() => view.button("Edit or cancel deposit").click());
    edit(amount(view.host), "25");
    await act(async () => view.button("Deposit LORDS").click());
    const newer = paid()!;
    const saved = attempt();
    landed(earlier);
    expect(paid()).toBe(newer);
    expect(attempt()).toBe(saved);
    expect(amount(view.host).value).toBe("25");
    expect(amount(view.host).disabled).toBe(true);
  } finally {
    view.unmount();
  }
});

it("allows editing a payment the ledger reverted", async () => {
  const view = await render();
  try {
    await act(async () => view.button("Deposit LORDS").click());
    const first = paid()!.calls[1].calldata.at(-1);
    const reverted = { isReverted: () => true, revert_reason: "Failure reason: 'Ledger: deposits paused'." };
    expect(await send(async () => ({ transaction_hash: "0xtx" }), Promise.resolve(reverted))).toEqual({
      kind: "refused",
      reason: "Ledger: deposits paused",
    });
    await expectEditable(view, first);
  } finally {
    view.unmount();
  }
});

const walletRefusals = [
  { name: "USER_REFUSED_OP", error: { code: 113, message: "USER_REFUSED_OP" } },
  { name: "User abort", error: new Error("User abort") },
];

it.each(walletRefusals)("allows cancelling and editing a $name refusal", async ({ error }) => {
  const view = await render();
  try {
    edit(amount(view.host), "25");
    await act(async () => view.button("Deposit LORDS").click());
    const first = paid()!.calls[1].calldata.at(-1);
    await expect(send(async () => Promise.reject(error))).rejects.toBe(error);
    await expectEditable(view, first);
  } finally {
    view.unmount();
  }
});

it("holds an uncertain payment's exact terms across reopening until the chain settles it", async () => {
  let view = await render();
  try {
    edit(amount(view.host), "25");
    await act(async () => view.button("Deposit LORDS").click());
    const first = paid()!.calls;
    expect(await send(async () => Promise.reject(new Error("response lost")))).toEqual({ kind: "unconfirmed" });
    expect(view.button("Edit or cancel deposit")).toBeUndefined();
    expect(view.host.textContent).toContain("Payment status is uncertain.");
    const saved = attempt();
    // The payment closed (the dialog's Close, or the page left): reopening offers the same payment again.
    view.unmount();
    closePayment();
    view = await render();
    expect(paid()).toBeNull();
    expect(amount(view.host).value).toBe("25");
    expect(amount(view.host).disabled).toBe(true);
    expect(view.button("Edit or cancel deposit")).toBeUndefined();
    expect(view.button("Deposit LORDS")).toBeUndefined();
    expect(view.host.textContent).toContain("Payment status is uncertain.");
    await act(async () => view.button("Retry payment").click());
    // The same payment, so the send's own check settles it and nothing is paid twice.
    expect(paid()!.calls).toEqual(first);
    expect(paid()!.calls[1].calldata.at(-2)).toBe("25");
    expect(attempt()).toBe(saved);
    // The chain says it never ran: its terms may change again.
    act(() => forgetUncertain("0x33"));
    expect(view.button("Edit or cancel deposit")).toBeDefined();
    expect(view.host.textContent).not.toContain("Payment status is uncertain.");
    land();
    expect(amount(view.host).disabled).toBe(false);
    expect(attempt()).toBeNull();
  } finally {
    view.unmount();
  }
});
