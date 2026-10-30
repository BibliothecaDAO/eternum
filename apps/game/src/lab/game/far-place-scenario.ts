import { readStructureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { entityHomeNamespace, expeditionRealmSite, getEntityName, readExpeditionRules } from "@bibliothecadao/eternum";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

import { LAB_GAME, type LabScenario } from "./lab-chain";
import { NEIGHBOUR, NEIGHBOUR_REALM, visitScenario } from "./visit-scenario";

/**
 * The neighbour's Kingdom out of the player's view, shared in Global (/lab/game?scenario=far-place): Herald serves the
 * player's own scope alone, as a live shard does, so the realm reaches this map only once the chip's press visits its
 * owner (playtest 29 October 2026, B5). The message is the neighbour's, as their client sends it: the realm, its day's
 * site and its owner.
 */
export const farPlaceScenario = (): LabScenario => {
  const game = visitScenario();
  const realm = game.store.require("Structure", { game_id: LAB_GAME.gameId, entity_id: NEIGHBOUR_REALM });
  const rules = readExpeditionRules(game.store, LAB_GAME.gameId)!;
  const site = expeditionRealmSite(rules, entityHomeNamespace(NEIGHBOUR_REALM), game.startsAt)!;
  const place = {
    kind: "structure",
    entityId: NEIGHBOUR_REALM,
    game: { chainId: LAB_GAME.chainId.toLowerCase(), gameId: LAB_GAME.gameId, name: "Lab" },
    name: getEntityName(NEIGHBOUR_REALM, game.store),
    icon: readStructureMeaning(game.store, realm),
    at: game.startsAt,
    tile: { col: site.col, row: site.row, alt: false },
    owner: { player: NEIGHBOUR, realm: NEIGHBOUR_REALM },
  };
  const shared = {
    id: "far-place-1",
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    sender: { playerId: NEIGHBOUR, displayName: "Isolde" },
    content: "hold here",
    createdAt: new Date().toISOString(),
    metadata: { place },
  };
  return {
    ...game,
    scoped: true,
    chat: (zoneId) => (zoneId === GLOBAL_CHAT_CHANNEL_ID ? [shared] : []),
  };
};
