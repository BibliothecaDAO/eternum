import { deepSites } from "@bibliothecadao/types";
import { nativeRuleConstants, type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { dayOf, readExpeditionRules } from "../../utils/expeditions";
import { entityMapPosition } from "../../utils/tile";

export interface DeepSiteView {
  id: bigint;
  kind: (typeof deepSites)[number]["id"];
  name: (typeof deepSites)[number]["name"];
  position: { x: number; y: number; alt: boolean };
  day: number;
  beastTroops: bigint;
  guard: NativeRows["Guard"] | undefined;
}

export function readDeepSites(store: NativeFactStore, timestamp: number): DeepSiteView[] {
  const gameId = configManager.getActiveGameId();
  const rules = store.get("DeepRules", { game_id: gameId });
  if (!rules) return [];
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) throw new Error("Deep sites require expedition rules");
  const day = dayOf(calendar, timestamp);
  if (!day) return [];
  const rows = [...store.inGame("DeepSite", gameId)];
  if (rows.length !== nativeRuleConstants.DEEP_SITE_COUNT) throw new Error("Incomplete Deep site facts");
  return deepSites.map((kind) => {
    const sites = rows.filter((row) => row.kind === kind.id);
    if (sites.length !== 1) throw new Error(`Expected one ${kind.name} site`);
    const site = sites[0]!;
    if (site.day > BigInt(day.index)) throw new Error("Deep site is ahead of the game clock");
    const current = site.day === BigInt(day.index);
    const guard = current
      ? store.require("Guard", { game_id: gameId, structure_id: site.entity_id, slot: 0 })
      : undefined;
    return {
      id: site.entity_id,
      kind: kind.id,
      name: kind.name,
      position: entityMapPosition(store, gameId, site.entity_id),
      day: day.index,
      beastTroops: guard ? guard.troops.count : rules.beast_count,
      guard,
    };
  });
}
