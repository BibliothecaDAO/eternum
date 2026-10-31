// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The account, the realm's LORDS, its withdrawal receipts, the clock and the ledger stand in; the season-over row, the
// rule of what is owed and the prompt's words are the real ones.
const world = vi.hoisted(() => ({
  session: null as null | { user: { address?: string } },
  held: 0 as number | undefined,
  receipts: [] as { claim_id: bigint; account: bigint; amount: bigint; prize_rank: number }[],
  paid: new Set<string>(),
  closed: false,
  now: 0,
  paymentReads: 0,
}));
const OWNER = 0x5eedn;
/** The season ends at 100,000 s; the ledger's claim deadline is a week later. */
const END = 100_000;
const DEADLINE = END + 7 * 86_400;
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: world.session }) }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { inGame: () => world.receipts, get: () => ({ end_at: END }) } } }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 1 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => world.now }));
vi.mock("@/runtime/l2-rpc", () => ({ L2_BLOCK_MS: 10 }));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x1ab9" }) }));
vi.mock("@/shell/value/ledger", () => ({
  environmentLedger: () => ({
    paid: async (_shard: string, claimId: string) => (world.paymentReads++, world.paid.has(claimId)),
    frontierClaims: async () => ({ deadline: DEADLINE, closed: world.closed }),
  }),
}));
vi.mock("./use-realm-lords", () => ({ useRealmLords: () => world.held }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: "/", search: "" }) }));

import { formatMoment } from "@bibliothecadao/types";
import { useLinkWalletPrompt } from "./link-wallet";
import { SeasonPayout } from "./season-payout";

const REALM = { entity_id: 7, owner: OWNER } as never;
const DATED = () => `Link a wallet by ${formatMoment(DEADLINE, world.now)} or these LORDS go to the next season`;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

/** The ledger's answers land, and a few of its block polls run. */
const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 60)));
const draw = async (node: React.ReactNode) => {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
  await settle();
  return host.textContent;
};
const receipt = (claim: number, amount: number, prizeRank = 0) => ({
  claim_id: BigInt(claim),
  account: OWNER,
  amount: BigInt(amount),
  prize_rank: prizeRank,
});
const linkButton = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Link wallet");

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  world.session = { user: {} };
  world.held = 0;
  world.receipts = [];
  world.paid = new Set();
  world.closed = false;
  world.now = END + 3_600;
  world.paymentReads = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => act(() => root.unmount()));

it("keeps the season's LORDS through the sweep, then the open card drops them once the ledger pays (review 2, P2-1)", async () => {
  world.held = 1_240;
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("1,240");
  expect(host.textContent).toContain(DATED());
  // Swept: the realm holds none, its receipt waits unpaid; the same card, drawn again.
  world.held = 0;
  world.receipts = [receipt(0xc1a, 1_240)];
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("1,240");
  expect(linkButton()).toBeDefined();
  // Paid on the ledger: the open card learns it from its own poll, with no remount, no invalidation, no navigation.
  world.paid = new Set([String(0xc1an)]);
  await settle();
  expect(host.textContent).toBe("");
  // A paid receipt is not read again.
  const reads = world.paymentReads;
  await settle();
  expect(world.paymentReads).toBe(reads);
});

it("asks only to link a wallet to receive them before the season ends", async () => {
  world.now = END - 60;
  world.held = 500;
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("Link a wallet to receive your LORDS");
  expect(host.textContent).not.toContain("next season");
});

it("owes an unpaid chest and prize until the ledger's claim deadline, by that date, then neither (review 2, P2-2)", async () => {
  world.receipts = [receipt(0xc1a, 400), receipt(0xa1, 300, 1)];
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("700");
  expect(host.textContent).toContain(DATED());
  // Past the deadline, unpaid: void, carried to the next season; nothing owed, nothing to link for.
  world.now = DEADLINE;
  expect(await draw(<SeasonPayout realm={REALM} />)).toBe("");
});

it("owes nothing once the season has closed on the ledger, whatever the clock", async () => {
  world.closed = true;
  world.receipts = [receipt(0xc1a, 400)];
  expect(await draw(<SeasonPayout realm={REALM} />)).toBe("");
});

it("tells the player with a wallet linked that the payout is automatic while a receipt is unpaid, and never another account's", async () => {
  world.session = { user: { address: "0x04a1" } };
  world.receipts = [receipt(0xc1a, 1_240), { ...receipt(0xc1b, 900), account: 0x7n }];
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("LORDS are paid out automatically at season end");
  expect(host.textContent).toContain("1,240");
  expect(host.textContent).not.toContain("2,140");
  expect(linkButton()).toBeUndefined();
});

const Prompt = ({ owed }: { owed: number | undefined }) => <p>{useLinkWalletPrompt(owed) ?? "none"}</p>;

it("prompts only a signed-in account with no linked wallet that is owed LORDS", async () => {
  expect(await draw(<Prompt owed={40} />)).toBe(DATED());
  expect(await draw(<Prompt owed={0} />)).toBe("none");
  expect(await draw(<Prompt owed={undefined} />)).toBe("none");
  world.session = { user: { address: "0x04a1" } };
  expect(await draw(<Prompt owed={40} />)).toBe("none");
  world.session = null;
  expect(await draw(<Prompt owed={40} />)).toBe("none");
});
