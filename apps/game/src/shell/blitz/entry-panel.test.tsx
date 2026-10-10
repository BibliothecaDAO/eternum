import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Call } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => ({ calls: [] as Call[][], owners: [] as string[] }));
// The ledger answers nothing here: a refetch after a send stays pending, never reaching a network.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  l2Provider: () => ({ callContract: () => new Promise(() => {}) }),
}));
const session = vi.hoisted(() => ({ refresh: vi.fn(async () => undefined) }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySessionStore: (select: (state: typeof session) => unknown) => select(session),
}));
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletSign: ({ owner, calls, onSent }: { owner: string; calls: Call[]; onSent: (hash: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        signed.calls.push(calls);
        signed.owners.push(owner);
        onSent("0xtx");
      }}
    >
      Sign
    </button>
  ),
}));

import type { LedgerLinkStatus, PaidGameLedger, PayoutWallet } from "@realms-world/identity";
import { payingWalletKey } from "../value/paying-wallet";
import { type EntryTerms, entryTermsKey } from "./entry";
import { PaidEntry } from "./entry-panel";

const WEI = 10n ** 18n;
const LEDGER: PaidGameLedger = {
  address: "0x1ed9e7",
  chainId: "0x534e5f4d41494e",
  shard: "0x52",
  gameId: 7,
};
const WALLET: PayoutWallet = { status: "ready", address: "0x4a1" };
const TERMS: EntryTerms = {
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  split: { protocolCutBps: 2000, chestLordsBps: 500 },
  cancelled: false,
  start: Math.floor(Date.now() / 1000) + 3600,
  seats: { taken: 17, total: 24 },
  credits: { swords: 2, shields: 0 },
  registration: { registered: false, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
  lordsToken: "0x10e5",
  lords: 2_140n * WEI,
  strk: 10n ** 17n,
};
const unmounts: (() => Promise<void>)[] = [];

const CONFIRMED: LedgerLinkStatus = {
  status: "confirmed",
  ledger: { address: "0x1ed9e7", chainId: "0x534e5f4d41494e" },
  wallet: "0x4a1",
  account: "0x7a",
};

/** `payer` is the wallet the game's registrations name for the account: null before it pays. */
const mount = async (
  terms: EntryTerms,
  wallet: PayoutWallet = WALLET,
  link: LedgerLinkStatus = CONFIRMED,
  payer: string | null = null,
) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(payingWalletKey(LEDGER, "0x7a"), payer);
  client.setQueryData(entryTermsKey(LEDGER, payer ?? "0x4a1"), terms);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PaidEntry ledger={LEDGER} wallet={wallet} link={link} account="0x7a" />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const press = (container: HTMLElement, text: string) =>
  act(async () =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text))!.click(),
  );

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  signed.calls = [];
  signed.owners = [];
});

it("pays the seat and the chosen flags from the payout wallet, a credit paying for the sword", async () => {
  const panel = await mount(TERMS);
  expect(panel.textContent).toContain("Credit ×2");
  await press(panel, "Sword");
  await press(panel, "Shield");
  expect(panel.textContent).toContain("1,000");
  // Where the 1,000 goes, as the preset splits it: 760 to the season pool, 40 to its chests, 200 to the treasury.
  const split = panel.querySelector('[aria-label^="Where this entry goes"]')!.textContent;
  expect(split).toBe("76040200");
  await press(panel, "Pay & join");
  await press(panel, "Sign");
  // register names no account: the ledger registers the one it links to the paying wallet.
  expect(signed.calls).toEqual([
    [
      expect.objectContaining({ entrypoint: "approve", calldata: ["0x1ed9e7", String(1_000n * WEI), "0"] }),
      expect.objectContaining({
        contractAddress: "0x1ed9e7",
        entrypoint: "register",
        calldata: ["0x52", "7", "1", "1"],
      }),
    ],
  ]);
});

it("names what is short, the missing STRK, the seat, and the refund", async () => {
  expect((await mount({ ...TERMS, lords: 320n * WEI })).textContent).toContain("Need 180 more LORDS");
  const noStrk = await mount({ ...TERMS, strk: 0n });
  expect(noStrk.textContent).toContain("No STRK for the fee");
  expect(noStrk.querySelector("a")?.getAttribute("href")).toBe("https://app.avnu.fi/en");

  const seat = {
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
  };
  expect((await mount({ ...TERMS, registration: seat }, WALLET, CONFIRMED, "0x4a1")).textContent).toContain("Seated");
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true }, WALLET, CONFIRMED, "0x4a1");
  expect(refund.textContent).toContain("Sword credit");
  await press(refund, "Take refund");
  await press(refund, "Sign");
  expect(signed.calls).toEqual([[expect.objectContaining({ entrypoint: "refund", calldata: ["0x52", "7"] })]]);

  expect((await mount(TERMS, { status: "no_wallet" })).textContent).toContain("Entry is paid from your payout wallet");
  expect((await mount({ ...TERMS, seats: { taken: 24, total: 24 } })).textContent).toContain(
    "Every seat in this game is taken.",
  );
});

it("shows linking until the services confirm the link, reading the session again, and a link for another account as a fault", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    const linking = await mount(TERMS, WALLET, { status: "linking" });
    expect(linking.textContent).toContain("Linking your wallet");
    expect([...linking.querySelectorAll("button")].map((button) => button.textContent)).not.toContain("Pay & join");
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(session.refresh).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }

  const elsewhere = await mount(TERMS, WALLET, { ...CONFIRMED, account: "0x99" });
  expect(elsewhere.textContent).toContain("This payout wallet is linked to another Realms account.");
  expect(elsewhere.textContent).not.toContain("Pay & join");

  const otherLedger = await mount(TERMS, WALLET, { ...CONFIRMED, ledger: { ...CONFIRMED.ledger, address: "0x2" } });
  expect(otherLedger.textContent).toContain("Your wallet is linked on another ledger than this game's.");
  expect(otherLedger.textContent).not.toContain("Linking your wallet");

  const linked = await mount(TERMS);
  expect(linked.textContent).toContain("Pay & join");
});

it("reads and refunds a seat through the wallet that paid it, after the payout wallet was replaced", async () => {
  const seat = {
    registered: true,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 500n * WEI,
  };
  // Paid from 0xa11; the payout wallet is now 0x4a1, whose own registration would read as no seat at all.
  const seated = await mount({ ...TERMS, registration: seat }, WALLET, CONFIRMED, "0xa11");
  expect(seated.textContent).toContain("Seated");
  expect(seated.textContent).not.toContain("Pay & join");
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true }, WALLET, CONFIRMED, "0xa11");
  await press(refund, "Take refund");
  await press(refund, "Sign");
  expect(signed.owners).toEqual(["0xa11"]);
  // A wallet that paid still holds its seat once the account has no payout wallet at all.
  expect(
    (await mount({ ...TERMS, registration: seat }, { status: "no_wallet" }, CONFIRMED, "0xa11")).textContent,
  ).toContain("Seated");
});
