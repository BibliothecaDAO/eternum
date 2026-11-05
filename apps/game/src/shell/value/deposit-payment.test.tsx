import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { outsideExecution, type Call } from "starknet";

// The purse's deposit paid end to end in this page: the purse, its payment on the app sheet, the one wallet send and the
// default wallet's passkey send, with only the passkey, the paymaster and the chain answered here.
const chain = vi.hoisted(() => ({
  sign: vi.fn<() => Promise<string[]>>(),
  execute: vi.fn(async () => "0xtx"),
}));
vi.mock("@/ui/modules/identity/passkey", async (actual) => ({
  ...(await actual<typeof import("@/ui/modules/identity/passkey")>()),
  signWithPasskey: chain.sign,
}));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: { executeDefaultWalletCall: chain.execute },
  useIdentitySession: () => ({ session: { user: { realmsId: "0x77" } } }),
}));
vi.mock("@/hooks/context/default-wallet", () => ({
  useDefaultWallet: () => ({
    wallet: {
      address: "0x33",
      credentialId: "c",
      publicKeyX: "0x1",
      origin: "https://realms.test",
      rpId: "realms.test",
    },
    failed: false,
    retry: () => {},
  }),
}));
// The default wallet signs with its passkey: no linked wallet is opened.
vi.mock("@/hooks/context/starknet-provider", () => ({
  StarknetProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/runtime/l2-rpc", () => ({
  L2_CHAIN: { id: "0x1" },
  L2_BLOCK_MS: 1000,
  l2Provider: () => ({
    waitForTransaction: async () => ({ isReverted: () => false }),
    getBlockWithTxHashes: async () => ({ block_number: 5, timestamp: 1_000 }),
    // The execution's nonce is still unspent: it has not run.
    callContract: async () => ["1"],
  }),
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 7 } }));
vi.mock("@/hooks/context/payout-wallet", () => ({ payoutAddressOf: () => "0x33" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 1000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => {} }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { get: () => ({ start_main_at: 1, end_at: 2000 }) } } }),
}));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x2" }) }));
vi.mock("@/shell/value/ledger", async (actual) => ({
  ...(await actual<typeof import("@/shell/value/ledger")>()),
  environmentLedger: () => ({ address: "0x10" }),
}));
vi.mock("@/shell/value/use-ledger-paused", () => ({ useLedgerPaused: () => false }));
vi.mock("@/ui/features/frontier/value/use-realm-lords", () => ({ useRealmLords: () => 90 }));
vi.mock("@/ui/features/frontier/value/use-spend-lords", () => ({
  useSpendLords: () => ({
    source: { chain: "0x1", ledger: "0x10" },
    balance: { available: 20n, swept: 0n },
    receipts: [],
  }),
}));
vi.mock("@/ui/features/frontier/value/link-wallet", () => ({ useLinkWallet: () => () => {} }));
vi.mock("@/ui/features/frontier/value/frontier-withdraw", () => ({ FrontierWithdraw: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "deposit-token" ? "0x99" : [],
    refetch: () => {},
  }),
}));

import { useDepositPaymentStore } from "@/hooks/store/use-deposit-payment-store";
import { FrontierPurse } from "@/ui/features/frontier/value/frontier-purse";
import { uncertainSendOf } from "@/ui/modules/identity/uncertain-sends";
import * as sends from "@/ui/modules/identity/wallet-send";
import { depositStructure } from "../../../../value-relay/test-support/deposit-structure";
import { DepositPaymentDialog } from "./deposit-payment";

/** The paymaster's build: the asked calls as an outside execution open until long after this test, sponsored. */
const prepared = (calls: Call[]) => ({
  execution: outsideExecution.getTypedData(
    "0x1",
    { caller: "0x123", execute_after: 1, execute_before: 1_900_000_000 },
    "0x1",
    calls,
    "2",
  ),
  fee: null,
});

/** The passkey's answer, held until the test gives it. */
const heldPasskey = () => {
  const answer = {} as { sign: () => void; decline: () => void };
  chain.sign.mockImplementationOnce(
    () =>
      new Promise((sign, decline) => {
        answer.sign = () => sign(["0x4", "0x9"]);
        answer.decline = () => decline(new DOMException("The operation was not allowed.", "NotAllowedError"));
      }),
  );
  return answer;
};

let view: { host: HTMLElement; unmount: () => void };

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  useDepositPaymentStore.setState({ payment: null });
  vi.spyOn(sends, "prepareDefaultWalletSend").mockImplementation(async (calls) => prepared(calls));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <>
        <FrontierPurse realm={depositStructure("0x30")} onClose={() => {}} />
        <DepositPaymentDialog />
      </>,
    ),
  );
  view = {
    host,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
});

afterEach(() => {
  view.unmount();
  vi.restoreAllMocks();
  chain.sign.mockReset();
  chain.execute.mockClear();
});

const buttons = () => [...document.querySelectorAll("button")].map((button) => button.textContent);
const press = (word: string) =>
  act(async () => {
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent === word);
    expect(button, word).toBeDefined();
    button!.click();
  });
const shows = (check: () => void) =>
  vi.waitFor(async () => {
    await act(async () => {});
    check();
  });
/** The payment's dialog on the app sheet, by its title (the purse is a dialog of its own, "LORDS"). */
const dialog = () =>
  document.querySelector('[role="dialog"][aria-label^="Deposit "]')?.getAttribute("aria-label") ?? null;
const purse = () => view.host.textContent ?? "";
const savedTerms = () => Object.keys(localStorage).filter((key) => key.startsWith("lords-deposit:"));
const edit = (value: string) =>
  act(() => {
    const input = view.host.querySelector<HTMLInputElement>('input[aria-label="Whole LORDS to deposit"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const amountLocked = () =>
  view.host.querySelector<HTMLInputElement>('input[aria-label="Whole LORDS to deposit"]')!.disabled;

/** The deposit begun and its payment showing the passkey's Confirm. */
const begin = async () => {
  await press("Deposit LORDS");
  await shows(() => expect(buttons()).toContain("Confirm with your passkey"));
  expect(dialog()).toBe("Deposit 10 LORDS");
};

it("pays the deposit with the passkey and closes the payment once it lands", async () => {
  await begin();
  chain.sign.mockResolvedValueOnce(["0x4", "0x9"]);
  await press("Confirm with your passkey");
  await shows(() => expect(dialog()).toBeNull());
  expect(chain.execute).toHaveBeenCalledOnce();
  expect(purse()).toContain("Payment confirmed. Waiting for the spend-only credit.");
  expect(savedTerms()).toEqual([]);
  expect(amountLocked()).toBe(false);
});

it.each([
  { way: "Close", close: () => press("Close") },
  {
    way: "Escape",
    close: () =>
      act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))),
  },
])(
  "closed by $way while its passkey is asked, keeps the deposit's terms until the late signature lands",
  async ({ close }) => {
    await begin();
    const passkey = heldPasskey();
    await press("Confirm with your passkey");
    await close();
    expect(dialog()).toBeNull();
    // The passkey can still sign and the send still go: its terms stay locked, and nothing new may be paid.
    expect(buttons()).not.toContain("Edit or cancel deposit");
    expect(purse()).toContain("Payment status is uncertain.");
    expect(amountLocked()).toBe(true);
    await press("Retry payment");
    // The same payment again, still on its way: nothing signed yet, so nothing to send again.
    await shows(() => expect(document.body.textContent).toContain("Your last send is on its way"));
    expect(dialog()).toBe("Deposit 10 LORDS");
    expect(buttons()).toContain("Check again");
    expect(buttons()).not.toContain("Send it again");
    expect(buttons()).not.toContain("Confirm with your passkey");

    await act(async () => passkey.sign());
    await shows(() => expect(dialog()).toBeNull());
    expect(chain.execute).toHaveBeenCalledOnce();
    expect(chain.execute).toHaveBeenCalledWith(expect.anything(), ["0x4", "0x9"]);
    expect(uncertainSendOf("0x33")).toBeUndefined();
    expect(purse()).toContain("Payment confirmed. Waiting for the spend-only credit.");
    expect(savedTerms()).toEqual([]);
  },
);

it("frees the deposit's terms once a passkey asked before its payment closed signs nothing", async () => {
  await begin();
  const passkey = heldPasskey();
  await press("Confirm with your passkey");
  await press("Close");
  expect(buttons()).not.toContain("Edit or cancel deposit");
  await act(async () => passkey.decline());
  await shows(() => expect(buttons()).toContain("Edit or cancel deposit"));
  expect(purse()).not.toContain("Payment status is uncertain.");
  expect(chain.execute).not.toHaveBeenCalled();
  expect(uncertainSendOf("0x33")).toBeUndefined();
});

it("closed while a stale fee is priced again, opens no passkey and sends nothing once the old price comes back", async () => {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  await begin();
  // Left open past its preparation's life: Confirm prepares it again, and that answer is held.
  now += 120_000;
  let release!: () => void;
  vi.mocked(sends.prepareDefaultWalletSend).mockImplementationOnce(
    (calls) => new Promise((resolve) => (release = () => resolve(prepared(calls)))),
  );
  await press("Confirm with your passkey");
  await press("Close");
  // Nothing was asked of the passkey yet: the terms may change.
  await press("Edit or cancel deposit");
  edit("25");
  await press("Deposit LORDS");
  await shows(() => expect(buttons()).toContain("Confirm with your passkey"));
  expect(dialog()).toBe("Deposit 25 LORDS");
  const terms = savedTerms().map((key) => localStorage.getItem(key));

  await act(async () => release());
  await act(async () => {});
  expect(chain.sign).not.toHaveBeenCalled();
  expect(chain.execute).not.toHaveBeenCalled();
  expect(uncertainSendOf("0x33")).toBeUndefined();
  expect(dialog()).toBe("Deposit 25 LORDS");
  expect(savedTerms().map((key) => localStorage.getItem(key))).toEqual(terms);
});
