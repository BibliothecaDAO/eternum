import { fetchHeraldAspectRoster, type GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldAspectRosterMember } from "@bibliothecadao/eternum/game-sync";
import { aspectName, aspects, raceRewards, type AspectId } from "@bibliothecadao/types";
import { RACE_CLAIM_WINDOW_SECONDS } from "@realms-world/value-ledger/codecs";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { L2_CHAIN, L2_LEDGER_DEPLOYMENT_BLOCK } from "@/runtime/l2-rpc";
import { requireOpenShard } from "@/runtime/world/shards";

import { type AspectSeasonGame, gameRefOf, isAspectSeason, useDirectory, useSettledGames } from "../herald";
import { gameKey } from "../play/play-board";
import { isWalletTabLocation } from "../profile/settings-route";
import { endedSeasons, realmHomeOf, seasonTitle } from "../season";
import { seasonRealm } from "../season-pick";
import { environmentRaceRewards, lordsOf } from "./ledger";
import type { SeasonRewardState } from "./season-reward-context";

export const URGENT_REWARD_WINDOW_SECONDS = 24 * 3600;

const ROSTER_PAGE_LIMIT = 100;
const CLOSED_STORAGE_PREFIX = "realms.reward-popup-closed.";

let warnedMissingRaceRewards = false;

export interface SeasonRewardLedgerRead {
  postedAt: number | null;
  closed: boolean;
  paid: { wallet: string; amount: bigint } | null;
  transactionHash: string | null;
}

interface RewardPopupDismissal {
  urgent: boolean;
}

const aspectOfRealm = (realm: { aspect: AspectId | null; realm_id: number }): AspectId | null =>
  realm.aspect ?? realmHomeOf(realm.realm_id).aspect;

export const seasonRewardAmountLords = (
  game: Pick<AspectSeasonGame, "aspect_race">,
  homeEntityId: number,
  aspect: AspectId,
  members: readonly HeraldAspectRosterMember[],
): number => {
  if (game.aspect_race.winner === undefined) return 0;
  const { rewards } = raceRewards({
    winner: game.aspect_race.winner,
    heights: aspects.map(({ id }) => ({ aspect: id, height: game.aspect_race.heights[id] })),
    members: members.map((member) => ({
      home: BigInt(member.entity_id),
      aspect,
      glory: BigInt(member.glory),
    })),
  });
  const own = rewards.find((reward) => reward.home === BigInt(homeEntityId));
  return own ? lordsOf(own.amount) : 0;
};

export const deriveSeasonRewardState = (input: {
  seasonKey: string;
  seasonTitle: string;
  aspect: AspectId;
  earnedLords: number;
  payoutWallet: string | null;
  ledger: SeasonRewardLedgerRead | null;
  now: number;
  explorerUrl?: string;
}): SeasonRewardState | null => {
  if (input.ledger === null) return null;
  const explorer = input.explorerUrl ?? L2_CHAIN.explorer;
  const base = {
    seasonKey: input.seasonKey,
    seasonTitle: input.seasonTitle,
    aspect: input.aspect,
    aspectLabel: aspectName(input.aspect),
    lords: input.earnedLords,
  };
  if (input.ledger.paid && input.ledger.paid.amount > 0n) {
    return {
      ...base,
      status: "paid",
      lords: lordsOf(input.ledger.paid.amount),
      wallet: input.ledger.paid.wallet,
      transactionUrl: input.ledger.transactionHash ? `${explorer}/tx/${input.ledger.transactionHash}` : null,
    };
  }
  if (input.earnedLords <= 0) return null;
  if (input.ledger.closed || input.ledger.postedAt === null) return null;
  const deadline = input.ledger.postedAt + RACE_CLAIM_WINDOW_SECONDS;
  const secondsLeft = deadline - input.now;
  if (secondsLeft <= 0) return null;
  const urgent = secondsLeft < URGENT_REWARD_WINDOW_SECONDS;
  if (input.payoutWallet === null) {
    return {
      ...base,
      status: "waiting",
      deadline,
      secondsLeft,
      urgent,
    };
  }
  return {
    ...base,
    status: "sending",
    wallet: input.payoutWallet,
    deadline,
    secondsLeft,
    urgent,
  };
};

export const rewardWindowProgress = (secondsLeft: number): number => {
  const clamped = Math.max(0, Math.min(RACE_CLAIM_WINDOW_SECONDS, secondsLeft));
  return (clamped / RACE_CLAIM_WINDOW_SECONDS) * 100;
};

export const readRewardPopupDismissal = (seasonKey: string): RewardPopupDismissal | null => {
  try {
    const raw = window.sessionStorage.getItem(`${CLOSED_STORAGE_PREFIX}${seasonKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { urgent?: unknown };
    return typeof parsed.urgent === "boolean" ? { urgent: parsed.urgent } : null;
  } catch {
    return null;
  }
};

const writeRewardPopupDismissal = (seasonKey: string, urgent: boolean): void => {
  try {
    window.sessionStorage.setItem(`${CLOSED_STORAGE_PREFIX}${seasonKey}`, JSON.stringify({ urgent }));
  } catch {}
};

export const shouldShowRewardPopup = (
  reward: SeasonRewardState | null,
  dismissal: RewardPopupDismissal | null,
  onWalletPage: boolean,
): boolean => {
  if (!reward || reward.status !== "waiting") return false;
  if (onWalletPage) return false;
  if (dismissal === null) return true;
  return reward.urgent && !dismissal.urgent;
};

export const isTerminalLedgerRead = (data: SeasonRewardLedgerRead | null | undefined, now: number): boolean => {
  if (data === null) return true;
  if (data === undefined) return false;
  if (data.closed || data.paid !== null) return true;
  if (data.postedAt !== null && now >= data.postedAt + RACE_CLAIM_WINDOW_SECONDS) return true;
  return false;
};

const fetchFullAspectRoster = async (ref: GameRef, aspect: AspectId): Promise<HeraldAspectRosterMember[]> => {
  const shard = await requireOpenShard(ref.chainId);
  const members: HeraldAspectRosterMember[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await fetchHeraldAspectRoster(shard, ref.gameId, aspect, { offset, limit: ROSTER_PAGE_LIMIT });
    members.push(...page.members);
    total = page.total;
    if (page.members.length < ROSTER_PAGE_LIMIT) break;
    offset += page.members.length;
  }
  return members;
};

const readRaceLedger = async (
  chainId: string,
  seasonId: number,
  home: number,
): Promise<SeasonRewardLedgerRead | null> => {
  const reader = environmentRaceRewards();
  if (!reader) {
    if (import.meta.env.DEV && !warnedMissingRaceRewards) {
      warnedMissingRaceRewards = true;
      console.warn("raceRewards contract address is missing from the environment address book");
    }
    return null;
  }
  const [season, paid] = await Promise.all([
    reader.raceSeason(chainId, seasonId),
    reader.raceReward(chainId, seasonId, home),
  ]);
  const transactionHash =
    paid && L2_LEDGER_DEPLOYMENT_BLOCK !== null
      ? await reader.racePaymentTransaction(chainId, seasonId, home, L2_LEDGER_DEPLOYMENT_BLOCK).catch(() => null)
      : null;
  return {
    postedAt: season.posted ? season.postedAt : null,
    closed: season.closed,
    paid,
    transactionHash,
  };
};

export const seasonRewardRosterKey = (chainId: string, gameId: number, aspect: AspectId) =>
  ["shell", "season-reward-roster", chainId, gameId, aspect] as const;

export const seasonRewardLedgerKey = (chainId: string, gameId: number, home: number) =>
  ["shell", "season-reward-ledger", chainId, gameId, home] as const;

const useActiveRewardClock = (active: boolean): number => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!active) return;
    setNow(Math.floor(Date.now() / 1000));
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
};

export const useSeasonReward = (): SeasonRewardState | null => {
  const { session } = useIdentitySession();
  const directory = useDirectory();
  const settled = useSettledGames();
  const payoutWallet = session ? payoutAddressOf(session.user) : null;

  const candidate = session
    ? (endedSeasons(directory.data?.games ?? [], settled.data ?? []).find(
        (game): game is AspectSeasonGame => isAspectSeason(game) && seasonRealm(game) !== null,
      ) ?? null)
    : null;
  const realm = candidate ? seasonRealm(candidate) : null;
  const aspect = realm ? aspectOfRealm(realm) : null;
  const ref = candidate ? gameRefOf(candidate) : null;

  const rosterQuery = useQuery({
    queryKey:
      ref && aspect !== null
        ? seasonRewardRosterKey(ref.chainId, ref.gameId, aspect)
        : ["shell", "season-reward-roster", "none"],
    queryFn: () => fetchFullAspectRoster(ref!, aspect!),
    enabled: ref !== null && aspect !== null,
    staleTime: 60_000,
  });

  const ledgerQuery = useQuery({
    queryKey:
      ref && realm
        ? seasonRewardLedgerKey(ref.chainId, ref.gameId, realm.entity_id)
        : ["shell", "season-reward-ledger", "none"],
    queryFn: () => readRaceLedger(ref!.chainId, ref!.gameId, realm!.entity_id),
    enabled: ref !== null && realm !== null,
    refetchInterval: (query) => {
      const now = Math.floor(Date.now() / 1000);
      if (isTerminalLedgerRead(query.state.data, now)) return false;
      return payoutWallet !== null ? 15_000 : 60_000;
    },
  });

  const earnedLords =
    candidate && realm && aspect !== null && rosterQuery.data
      ? seasonRewardAmountLords(candidate, realm.entity_id, aspect, rosterQuery.data)
      : 0;
  const ticking =
    candidate !== null &&
    earnedLords > 0 &&
    ledgerQuery.data !== null &&
    ledgerQuery.data !== undefined &&
    !ledgerQuery.data.paid &&
    !ledgerQuery.data.closed &&
    ledgerQuery.data.postedAt !== null;
  const now = useActiveRewardClock(ticking);

  if (!candidate || !realm || aspect === null || !rosterQuery.data) return null;
  return deriveSeasonRewardState({
    seasonKey: gameKey(candidate),
    seasonTitle: seasonTitle(candidate),
    aspect,
    earnedLords,
    payoutWallet,
    ledger: ledgerQuery.data ?? null,
    now,
  });
};

export const useRewardPopupState = (reward: SeasonRewardState | null) => {
  const location = useLocation();
  const onWalletPage = isWalletTabLocation(location.pathname, location.hash, location.search);
  const seasonKey = reward?.seasonKey ?? null;
  const [dismissal, setDismissal] = useState<RewardPopupDismissal | null>(() =>
    seasonKey ? readRewardPopupDismissal(seasonKey) : null,
  );
  useEffect(() => {
    setDismissal(seasonKey ? readRewardPopupDismissal(seasonKey) : null);
  }, [seasonKey]);
  const dismiss = useCallback(() => {
    if (!reward || reward.status !== "waiting") return;
    writeRewardPopupDismissal(reward.seasonKey, reward.urgent);
    setDismissal({ urgent: reward.urgent });
  }, [reward]);
  return {
    open: shouldShowRewardPopup(reward, dismissal, onWalletPage),
    dismiss,
  };
};
