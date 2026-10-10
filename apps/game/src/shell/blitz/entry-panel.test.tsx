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
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletSign: ({ owner, calls, onLanded }: { owner: string; calls: Call[]; onLanded: () => void }) => (
    <button
      type="button"
      onClick={() => {
        signed.calls.push(calls);
        signed.owners.push(owner);
        onLanded();
      }}
    >
      Sign
    </button>
  ),
}));

import type { PaidGameLedger, PayoutWallet } from "@realms-world/identity";
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
};
const unmounts: (() => Promise<void>)[] = [];

/** The ledger's terms for the payout wallet 0x4a1. */
const mount = async (terms: EntryTerms, wallet: PayoutWallet = WALLET) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(entryTermsKey(LEDGER, "0x4a1"), terms);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PaidEntry ledger={LEDGER} wallet={wallet} />
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

it("names what is short, the seat, and the refund", async () => {
  expect((await mount({ ...TERMS, lords: 320n * WEI })).textContent).toContain("Need 180 more LORDS");
  // 0.1 LORDS short of the 500 seat is one more to find, never "Need 0 more".
  expect((await mount({ ...TERMS, lords: 500n * WEI - WEI / 10n })).textContent).toContain("Need 1 more LORDS");

  const seat = {
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
  };
  expect((await mount({ ...TERMS, registration: seat })).textContent).toContain("Seated");
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true });
  expect(refund.textContent).toContain("Sword credit");
  await press(refund, "Take refund");
  await press(refund, "Sign");
  expect(signed.calls).toEqual([[expect.objectContaining({ entrypoint: "refund", calldata: ["0x52", "7"] })]]);

  expect((await mount(TERMS, { status: "no_wallet" })).textContent).toContain("Entry is paid from your payout wallet");
  expect((await mount({ ...TERMS, seats: { taken: 24, total: 24 } })).textContent).toContain(
    "Every seat in this game is taken.",
  );
});

it("lets a linked payout wallet pay at once: nothing waits on a link", async () => {
  const panel = await mount(TERMS);
  expect(panel.textContent).toContain("Pay & join");
  expect(panel.textContent).not.toContain("Linking");
});

it("reads a slot's entry and refund with the payout wallet that pays, signed by it", async () => {
  const seat = {
    registered: true,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 500n * WEI,
  };
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true });
  await press(refund, "Take refund");
  await press(refund, "Sign");
  expect(signed.owners).toEqual(["0x4a1"]);
});
