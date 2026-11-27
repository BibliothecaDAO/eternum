import {
  aspects,
  formatDate,
  formatDuration,
  formatExact,
  raceRewards,
  RESOURCE_PRECISION,
  StructureType,
} from "@bibliothecadao/types";
import type { Session } from "@realms-world/identity";
import { RACE_CLAIM_WINDOW_SECONDS } from "@realms-world/value-ledger/codecs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { LATER, LINK_WALLET, SEASON_REWARD_WORDS, linkWalletBy } from "@/ui/design-system/kit/words";

import type { DirectoryGame } from "../herald";
import { DEVICES_PATH, linkWalletHref, WALLET_PATH } from "../profile/settings-route";
import {
  deriveSeasonRewardState,
  isTerminalLedgerRead,
  readRewardPopupDismissal,
  seasonRewardAmountLords,
  seasonRewardLedgerKey,
  seasonRewardRosterKey,
  shouldShowRewardPopup,
  URGENT_REWARD_WINDOW_SECONDS,
  type SeasonRewardLedgerRead,
} from "./season-reward";
import { SeasonRewardProvider } from "./season-reward-popup";

const mounted: (() => Promise<void>)[] = [];

const ENDED_SEASON: DirectoryGame = {
  chainId: "0x5245414c4d53",
  game_id: 3,
  name: "frontier-0",
  mode: "frontier",
  status: "Ended",
  dev_mode_on: false,
  clock_scale: 1,
  expedition: null,
  season_number: 1,
  clock: {
    start_settling_at: 1_695_000_000,
    start_main_at: 1_695_000_000,
    scheduled_end_at: 1_700_000_000,
    end_at: 1_700_000_000,
  },
  player_count: 100,
  aspect_members: { 1: 2, 2: 2, 3: 1, 4: 1 },
  aspect_race: {
    finish_height: 10_000,
    season_days: 50,
    heights: { 1: 10_000, 2: 8_000, 3: 5_000, 4: 4_000 },
    triumph_percents: { 1: 10, 2: 20, 3: 30, 4: 40 },
    winner: 1,
  },
  player_state: {
    registered: true,
    settled: true,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    fragments: null,
    ancient_seal: false,
    structures: [
      {
        entity_id: 1,
        category: StructureType.Realm,
        level: 1,
        realm_id: 3098,
        coord_x: null,
        coord_y: null,
        resources_packed: "0",
        aspect: 1,
        has_wonder: false,
        realm_skin: 0,
      },
    ],
  },
  registration: null,
  settled_realms_count: 1,
  settled_villages_count: 0,
  settlement: null,
};

const ROSTER = [
  { rank: 1, entity_id: "1", realm_id: 3098, owner: "0x1", glory: String(3_000n * BigInt(RESOURCE_PRECISION)) },
  { rank: 2, entity_id: "2", realm_id: 3099, owner: "0x2", glory: String(1_000n * BigInt(RESOURCE_PRECISION)) },
];

const SESSION: Session = {
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: {
    id: "u",
    realmsId: "0x7",
    name: "Kael",
    email: "kael@realms.test",
    image: null,
    address: null,
  },
} as unknown as Session;

const mountProvider = async (ledger: SeasonRewardLedgerRead, path = "/") => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "getSession").mockResolvedValue(SESSION);
  useIdentitySessionStore.getState().applySession(SESSION);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["shell", "directory", "0x7"], { games: [ENDED_SEASON] });
  client.setQueryData(["shell", "history", "all"], []);
  client.setQueryData(seasonRewardRosterKey(ENDED_SEASON.chainId, ENDED_SEASON.game_id, 1), ROSTER);
  client.setQueryData(seasonRewardLedgerKey(ENDED_SEASON.chainId, ENDED_SEASON.game_id, 1), ledger);

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <SeasonRewardProvider>
            <div data-testid="app-body" />
          </SeasonRewardProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  mounted.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

beforeEach(() => {
  window.sessionStorage.clear();
  useIdentitySessionStore.getState().applySession(null);
});

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await unmount();
  vi.restoreAllMocks();
});

describe("seasonRewardAmountLords", () => {
  it("matches raceRewards exactly and uses the recorded winner on tied finish heights", () => {
    const tied = {
      aspect_race: {
        finish_height: 10_000,
        season_days: 50,
        heights: { 1: 10_000, 2: 10_000, 3: 5_000, 4: 4_000 },
        triumph_percents: { 1: 10, 2: 20, 3: 30, 4: 40 },
        winner: 2 as const,
      },
    };
    const fromRelay = (aspect: 1 | 2) =>
      raceRewards({
        winner: 2,
        heights: aspects.map(({ id }) => ({ aspect: id, height: tied.aspect_race.heights[id] })),
        members: ROSTER.map((member) => ({ home: BigInt(member.entity_id), aspect, glory: BigInt(member.glory) })),
      }).rewards;

    const expectedAspect1Own = Number(fromRelay(1).find((row) => row.home === 1n)!.amount / 10n ** 18n);
    const expectedAspect2Own = Number(fromRelay(2).find((row) => row.home === 1n)!.amount / 10n ** 18n);

    expect(seasonRewardAmountLords(tied, 1, 1, ROSTER)).toBe(expectedAspect1Own);
    expect(seasonRewardAmountLords(tied, 1, 2, ROSTER)).toBe(expectedAspect2Own);
    expect(expectedAspect2Own).toBeGreaterThan(expectedAspect1Own);
    expect(seasonRewardAmountLords({ aspect_race: { ...tied.aspect_race, winner: undefined } }, 1, 2, ROSTER)).toBe(0);
    expect(seasonRewardAmountLords(tied, 99, 2, ROSTER)).toBe(0);
  });
});

describe("deriveSeasonRewardState", () => {
  const postedAt = 1_700_000_000;
  const base = {
    seasonKey: "0x5245414c4d53:3",
    seasonTitle: "Season 1",
    aspect: 1 as const,
    earnedLords: 1_420,
    payoutWallet: null,
    ledger: { postedAt, closed: false, paid: null, transactionHash: null } satisfies SeasonRewardLedgerRead,
  };

  it("uses postedAt + RACE_CLAIM_WINDOW_SECONDS for waiting, urgent <24h, and expired windows", () => {
    const normal = deriveSeasonRewardState({ ...base, now: postedAt + 3600 });
    expect(normal?.status).toBe("waiting");
    if (normal?.status === "waiting") {
      expect(normal.deadline).toBe(postedAt + RACE_CLAIM_WINDOW_SECONDS);
      expect(normal.urgent).toBe(false);
    }

    const urgent = deriveSeasonRewardState({
      ...base,
      now: postedAt + RACE_CLAIM_WINDOW_SECONDS - URGENT_REWARD_WINDOW_SECONDS + 60,
    });
    expect(urgent?.status).toBe("waiting");
    if (urgent?.status === "waiting") {
      expect(urgent.urgent).toBe(true);
    }

    expect(deriveSeasonRewardState({ ...base, now: postedAt + RACE_CLAIM_WINDOW_SECONDS })).toBeNull();
    expect(deriveSeasonRewardState({ ...base, ledger: null, now: postedAt + 3600 })).toBeNull();
    expect(
      deriveSeasonRewardState({
        ...base,
        ledger: { postedAt: null, closed: false, paid: null, transactionHash: null },
        now: postedAt + 3600,
      }),
    ).toBeNull();
  });

  it("transitions to sending once a wallet is linked and paid once the ledger records payment", () => {
    const wallet = "0x04a1";
    const sending = deriveSeasonRewardState({ ...base, payoutWallet: wallet, now: postedAt + 3600 });
    expect(sending?.status).toBe("sending");

    const paid = deriveSeasonRewardState({
      ...base,
      payoutWallet: wallet,
      now: postedAt + 3600,
      ledger: {
        postedAt,
        closed: false,
        paid: { wallet, amount: 1_420n * 10n ** 18n },
        transactionHash: "0xabc",
      },
      explorerUrl: "https://voyager.online",
    });
    expect(paid).toMatchObject({
      status: "paid",
      lords: 1_420,
      wallet,
      transactionUrl: "https://voyager.online/tx/0xabc",
    });
  });

  it("stops polling for terminal ledger states (null, closed, paid, expired)", () => {
    expect(isTerminalLedgerRead(null, postedAt + 100)).toBe(true);
    expect(isTerminalLedgerRead(undefined, postedAt + 100)).toBe(false);
    expect(isTerminalLedgerRead(base.ledger, postedAt + 3600)).toBe(false);
    expect(isTerminalLedgerRead(base.ledger, postedAt + RACE_CLAIM_WINDOW_SECONDS)).toBe(true);
    expect(isTerminalLedgerRead({ ...base.ledger, closed: true }, postedAt + 3600)).toBe(true);
    expect(isTerminalLedgerRead({ ...base.ledger, paid: { wallet: "0x1", amount: 1n } }, postedAt + 3600)).toBe(true);
  });
});

describe("SeasonRewardProvider and SeasonRewardPopup", () => {
  const expectedLords = seasonRewardAmountLords({ aspect_race: ENDED_SEASON.aspect_race! }, 1, 1, ROSTER);

  it("shows earned LORDS through SeasonRewardProvider, dismisses on Later, and re-prompts inside <24h", async () => {
    const now = Math.floor(Date.now() / 1000);
    const postedAt = now - 10 * 3600;
    const deadline = postedAt + RACE_CLAIM_WINDOW_SECONDS;

    await mountProvider({ postedAt, closed: false, paid: null, transactionHash: null }, "/");
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(SEASON_REWARD_WORDS.title(formatExact(expectedLords)));
    expect(dialog?.textContent).toContain(SEASON_REWARD_WORDS.automaticLine);
    expect(dialog?.textContent).toContain(linkWalletBy(formatDate(deadline)));
    expect(dialog?.textContent).toContain(LINK_WALLET);

    const laterButton = [...document.body.querySelectorAll("button")].find((button) => button.textContent === LATER)!;
    await act(async () => laterButton.click());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(readRewardPopupDismissal("0x5245414c4d53:3")).toEqual({ urgent: false });
    expect(
      shouldShowRewardPopup(
        deriveSeasonRewardState({
          seasonKey: "0x5245414c4d53:3",
          seasonTitle: "Season 1",
          aspect: 1,
          earnedLords: expectedLords,
          payoutWallet: null,
          ledger: { postedAt, closed: false, paid: null, transactionHash: null },
          now,
        }),
        readRewardPopupDismissal("0x5245414c4d53:3"),
        false,
      ),
    ).toBe(false);

    const urgentPostedAt = now - (RACE_CLAIM_WINDOW_SECONDS - (11 * 3600 + 42 * 60));
    await mountProvider({ postedAt: urgentPostedAt, closed: false, paid: null, transactionHash: null }, "/");
    const urgentDialog = document.body.querySelector('[role="dialog"]');
    expect(urgentDialog?.textContent).toContain(SEASON_REWARD_WORDS.linkWalletNow);
    expect(urgentDialog?.textContent).toContain(
      SEASON_REWARD_WORDS.urgentTitle(
        formatDuration(urgentPostedAt + RACE_CLAIM_WINDOW_SECONDS - now),
        formatExact(expectedLords),
      ),
    );
  });

  it("stays suppressed whenever the profile wallet tab is open (#wallet, #devices, or ?next=)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const ledger: SeasonRewardLedgerRead = { postedAt: now - 3600, closed: false, paid: null, transactionHash: null };
    for (const walletPath of [WALLET_PATH, DEVICES_PATH, linkWalletHref("/shop")]) {
      await mountProvider(ledger, walletPath);
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    }
  });
});
