import { StructureType } from "@bibliothecadao/types";
import { getBlockTimestamp } from "../../utils/timestamp";
import { nativeBaneConstants, nativeRaceConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { entityHomeNamespace } from "../../utils/entity-home";
import { expeditionDepth, siteReward, readExpeditionRules } from "../../utils/expeditions";
import { BANE_MODELS, readBaneEffects } from "./banes";
import { TRIUMPH_MODELS, readTriumphPeriod } from "./triumphs";
import { readOptionalSeasonRow } from "./season-rows";

export const SITE_EFFECT_MODELS = [
  ...BANE_MODELS,
  ...TRIUMPH_MODELS,
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
  "Structure",
  "ExpeditionSite",
  "DepthRules",
] as const;

export interface SiteEffects {
  beastBps: number;
  spoilsPercent: number;
}

/** Effects change current strength and numeric rewards; the Deep retains its native amounts. */
export function readSiteEffects(
  store: NativeFactStore,
  site: NativeRows["ExpeditionSite"],
  timestamp?: number,
): NativeFactResult<SiteEffects> {
  const gameId = site.game_id;
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) return { unknown: "MISSING_EXPEDITION_RULES" };
  const depth = expeditionDepth(calendar, { y: site.row });
  if (depth === 3) return { known: { beastBps: 10_000, spoilsPercent: 100 } };
  const baneRules = readOptionalSeasonRow(store, "BaneRules", { game_id: gameId });
  if (!baneRules.known) return baneRules;
  const race = readOptionalSeasonRow(store, "RaceRules", { game_id: gameId });
  if (!race.known) return race;
  if (!race.known.row && !baneRules.known.row) return { known: { beastBps: 10_000, spoilsPercent: 100 } };
  const namespace = entityHomeNamespace(site.entity_id);
  const home = [...store.inGame("Structure", gameId)].find(
    (row) => row.base.category === StructureType.Realm && entityHomeNamespace(row.entity_id) === namespace,
  )?.entity_id;
  if (home === undefined) return { unknown: "MISSING_SITE_HOME" };
  const at = timestamp ?? getBlockTimestamp().currentDefaultTick;
  const bane = readBaneEffects(store, gameId, home, at, at + 1);
  if (!bane.known) return bane;
  let moon = 100;
  let spoilsPercent = 100;
  if (race.known.row) {
    const pale = readTriumphPeriod(store, gameId, home, nativeRaceConstants.PALE_MOON_STAGE, calendar);
    if (!pale.known) return pale;
    const spoils = readTriumphPeriod(store, gameId, home, nativeRaceConstants.SPOILS_STAGE, calendar);
    if (!spoils.known) return spoils;
    if (pale.known.period && at >= pale.known.period.start && at < pale.known.period.end)
      moon = race.known.row.pale_moon_percent;
    if (spoils.known.period && at >= spoils.known.period.start && at < spoils.known.period.end)
      spoilsPercent = race.known.row.spoils_percent;
  }
  const blood = bane.known.windows.some((window) => window.kinds.includes(nativeBaneConstants.BLOOD_MOON));
  return { known: { beastBps: moon * (blood ? bane.known.beastPercent : 100), spoilsPercent } };
}

export const effectiveGuardCount = (base: bigint, bps: number): bigint => (base * BigInt(bps) + 9_999n) / 10_000n;

/** Current numeric payout before the attacking army's relics; clear receipts retain the final credited award. */
export function readSiteReward(
  store: NativeFactStore,
  site: NativeRows["ExpeditionSite"],
  timestamp?: number,
): NativeFactResult<{ reward: ReturnType<typeof siteReward> }> {
  const effects = readSiteEffects(store, site, timestamp);
  if (!effects.known) return effects;
  const percent = effects.known.spoilsPercent;
  const base = siteReward(store, site);
  return {
    known: {
      reward: base && { ...base, amount: (base.amount * BigInt(percent)) / 100n },
    },
  };
}
