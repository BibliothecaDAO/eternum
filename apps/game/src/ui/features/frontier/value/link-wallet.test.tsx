// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The account, the realm's LORDS, its withdrawal receipts and the ledger's payments stand in; the season-over row, the
// rule of what is owed and the prompt's words are the real ones.
const world = vi.hoisted(() => ({
  session: null as null | { user: { address?: string } },
  held: 0 as number | undefined,
  receipts: [] as { claim_id: bigint; account: bigint; amount: bigint; prize_rank: number }[],
  paid: new Set<string>(),
  ledger: true,
}));
const OWNER = 0x5eedn;
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: world.session }) }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { inGame: () => world.receipts } } }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 1 }));
vi.mock("@/runtime/world/store", () => ({ requireActiveGame: () => ({ chainId: "0x1ab9" }) }));
vi.mock("@/shell/value/ledger", () => ({
  environmentLedger: () =>
    world.ledger ? { paid: async (_shard: string, claimId: string) => world.paid.has(claimId) } : null,
}));
vi.mock("./use-realm-lords", () => ({ useRealmLords: () => world.held }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: "/", search: "" }) }));

import { useLinkWalletPrompt } from "./link-wallet";
import { SeasonPayout } from "./season-payout";

const REALM = { entity_id: 7, owner: OWNER } as never;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

const draw = async (node: React.ReactNode) => {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
  // The ledger's answers land.
  await act(async () => await new Promise((resolve) => setTimeout(resolve, 0)));
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
  world.ledger = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => act(() => root.unmount()));

it("keeps the season's LORDS and Link wallet through the sweep, until the ledger pays them (review P2)", async () => {
  // Held in the realm, before the sweep.
  world.held = 1_240;
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("1,240");
  expect(host.textContent).toContain("Link a wallet to receive your LORDS");
  expect(linkButton()).toBeDefined();
  // Swept: the realm holds none, its receipt waits unpaid for a wallet.
  world.held = 0;
  world.receipts = [receipt(0xc1a, 1_240)];
  expect(await draw(<SeasonPayout realm={REALM} key="swept" />)).toContain("1,240");
  expect(host.textContent).toContain("Link a wallet to receive your LORDS");
  expect(linkButton()).toBeDefined();
  // Paid: nothing owed, nothing shown.
  world.paid = new Set([String(0xc1an)]);
  expect(await draw(<SeasonPayout realm={REALM} key="paid" />)).toBe("");
});

it("tells the player with a wallet linked that the payout is automatic, owed or not yet paid", async () => {
  world.session = { user: { address: "0x04a1" } };
  world.receipts = [receipt(0xc1a, 1_240)];
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("LORDS are paid out automatically at season end");
  expect(linkButton()).toBeUndefined();
});

it("owes a prize the realm never held, and names no deadline the ledger does not enforce", async () => {
  world.receipts = [receipt(0xa1, 300, 1)];
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("300");
  expect(host.textContent).toContain("Link a wallet to receive your LORDS");
  expect(host.textContent).not.toMatch(/ by |next season/);
});

it("counts a receipt as owed where this environment has no ledger to pay it, and another account's never", async () => {
  world.ledger = false;
  world.receipts = [receipt(0xc1a, 500), { ...receipt(0xc1b, 900), account: 0x7n }];
  expect(await draw(<SeasonPayout realm={REALM} />)).toContain("500");
  expect(host.textContent).not.toContain("1,400");
});

const Prompt = ({ owed }: { owed: number | undefined }) => <p>{useLinkWalletPrompt(owed) ?? "none"}</p>;

it("prompts only a signed-in account with no linked wallet that is owed LORDS", async () => {
  expect(await draw(<Prompt owed={40} />)).toBe("Link a wallet to receive your LORDS");
  expect(await draw(<Prompt owed={0} />)).toBe("none");
  expect(await draw(<Prompt owed={undefined} />)).toBe("none");
  world.session = { user: { address: "0x04a1" } };
  expect(await draw(<Prompt owed={40} />)).toBe("none");
  world.session = null;
  expect(await draw(<Prompt owed={40} />)).toBe("none");
});
