import { armyRelicsEnabled, collectArmyRelic, type RelicCollectOutcome } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { ARMY_RELIC_MODELS, readArmyRelics } from "./army-relics";
import type { ArmyRelic } from "./relic-catalog";

type TargetSite = Pick<NativeRows["ExpeditionSite"], "game_id" | "entity_id" | "category">;

type RuinRelicState =
  | { kind: "none" }
  | { kind: "cache"; fragments: number }
  | { kind: "unknown"; relic: ArmyRelic | null }
  | { kind: "outcome"; relic: ArmyRelic; outcome: RelicCollectOutcome; previousRank: number; resultRank: number };

const RUIN_RELIC_MODELS = ["RuinRelic", "RuinCache", "SliceRules", ...ARMY_RELIC_MODELS] as const;

const relicPaidBy = (
  store: Pick<NativeFactStore, "get" | "subscriptionScope">,
  site: TargetSite,
): ArmyRelic | null | undefined => {
  if (site.category !== StructureType.Ruin) return null;
  const row = store.get("RuinRelic", { game_id: site.game_id, entity_id: site.entity_id });
  if (row) return { kind: row.kind, rank: row.rank };
  return armyRelicsEnabled(store, site.game_id) === false ? null : undefined;
};

export const ruinRelicState = (
  store: Pick<NativeFactStore, "get" | "requireOrAbsent" | "subscriptionScope">,
  site: TargetSite,
  armyId: number | null,
  now: number,
): RuinRelicState => {
  const cache = store.get("RuinCache", { game_id: site.game_id, entity_id: site.entity_id });
  if (cache) return { kind: "cache", fragments: Number(cache.fragments) };
  const relic = relicPaidBy(store, site);
  if (relic === null) return { kind: "none" };
  if (relic === undefined) return { kind: "unknown", relic: null };
  const army = armyId === null ? null : readArmyRelics(store, site.game_id, armyId, now);
  if (!army) return { kind: "unknown", relic };
  const resolved = collectArmyRelic(army.loadout, relic);
  return {
    kind: "outcome",
    relic,
    outcome: resolved.outcome,
    previousRank: resolved.previousRank,
    resultRank: resolved.resultRank,
  };
};

const relicHold = (state: RuinRelicState): string | null => {
  if (state.kind === "unknown") return state.relic ? RELIC_WORDS.reading : RELIC_WORDS.readingRuin;
  return null;
};

export const useRuinRelicChoice = (site: TargetSite | null, armyId: number | null) => {
  const { setup } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(RUIN_RELIC_MODELS);
  if (site === null) return null;
  const state = ruinRelicState(setup.store, site, armyId, now);
  const ensureReady = () => {
    const hold = relicHold(ruinRelicState(setup.store, site, armyId, now));
    if (hold) throw new Error(hold);
  };
  return { state, hold: relicHold(state), ensureReady };
};
