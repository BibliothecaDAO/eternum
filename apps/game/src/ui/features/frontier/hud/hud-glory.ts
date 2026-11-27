import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { HUD_GLORY_WORDS } from "@/ui/design-system/kit/words";
import { configManager, DEEP_PAYOUT_MODELS } from "@bibliothecadao/eternum";
import {
  activeDeepSitePayPerMinute,
  gloryAmount,
  ownRaceGlory,
  readSyncedDeepSites,
  type NativeFactStore,
  type RaceBoard,
} from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useAspectBoard } from "../aspect/aspect-page";
import { readDeepSitePays } from "../deep/deep-site-faces";
import { useFrontierRealm } from "../frontier-home";

export type HudGloryState = {
  glory: number;
  earningPerMin: number;
  active: boolean;
};

const DEEP_GLORY_MODELS = [...DEEP_PAYOUT_MODELS, "DeepEntries", "TileOccupancy", "RaceRules", "BaneRules"] as const;

export function useHudGlory(): HudGloryState | null {
  const { setup } = useGame();
  const home = useFrontierRealm();
  const now = useCurrentDefaultTick();
  const race = useAspectBoard();
  useNativeRevision(DEEP_GLORY_MODELS);
  return readHudGlory(race.known?.race, setup.store, configManager.getActiveGameId(), home?.entity_id ?? null, now);
}

export function readHudGlory(
  board: RaceBoard | null | undefined,
  store: NativeFactStore,
  gameId: number,
  home: bigint | null,
  now: number,
): HudGloryState | null {
  if (!board || home === null) return null;
  const glory = ownRaceGlory(board);
  if (glory === null) return null;
  const earningPerMin = readActiveGloryPerMinute(store, gameId, home, now);
  return { glory, earningPerMin, active: earningPerMin > 0 };
}

export function showHudGlory(state: HudGloryState | null | undefined): state is HudGloryState {
  return Boolean(state && (state.glory > 0 || state.active));
}

export function hudGloryTip(state: HudGloryState): string {
  return state.active ? HUD_GLORY_WORDS.earningTip(state.glory, state.earningPerMin) : HUD_GLORY_WORDS.tip(state.glory);
}

export function readActiveGloryPerMinute(
  store: NativeFactStore,
  gameId: number,
  home: bigint,
  timestamp: number,
): number {
  let scaledPerMin = 0n;
  for (const site of readSyncedDeepSites(store, timestamp, gameId)) {
    if (!site.open || site.buildingPay <= 0 || site.garrisons.length === 0) continue;
    if (!readDeepSitePays(store, gameId, site.kind)?.includes("glory")) continue;
    const pool = BigInt(site.buildingPay) * BigInt(RESOURCE_PRECISION);
    scaledPerMin += activeDeepSitePayPerMinute(store, gameId, site, home, pool, timestamp);
  }
  return gloryAmount(scaledPerMin);
}
