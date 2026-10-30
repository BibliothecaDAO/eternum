import { readStructureMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { entityHomeNamespace, expeditionRealmSite, getEntityName, readExpeditionRules } from "@bibliothecadao/eternum";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

import { LAB_GAME, type LabFact, type LabScenario } from "./lab-chain";
import { NEIGHBOUR, NEIGHBOUR_REALM, visitScenario } from "./visit-scenario";

/**
 * The neighbour's Kingdom and one of its armies out of the player's view, each shared in Global
 * (/lab/game?scenario=far-place): Herald serves the player's own scope alone, as a live shard does, so they reach this
 * map only once a chip's press visits their owner, and Leave takes the player home (playtest 29 October 2026, B5). The
 * messages are the neighbour's, as their client sends them: the place, where it stood and its owner.
 */
/** The player's army in the base game, and the neighbour's. */
const OWN_ARMY = 201;
const NEIGHBOUR_ARMY = 211;

export const farPlaceScenario = (): LabScenario => {
  const game = visitScenario();
  // The neighbour's army beside their realm: the player's own army's row, theirs and a hundred tiles east.
  const own = game.store.require("ExplorerTroops", { game_id: LAB_GAME.gameId, explorer_id: BigInt(OWN_ARMY) });
  const stands = game.store.entityOccupancy(LAB_GAME.gameId, OWN_ARMY)!;
  const armyTile = { col: stands.col + 100, row: stands.row, alt: stands.alt };
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? String(field) : field)));
  const facts: LabFact[] = [
    {
      model: "ExplorerTroops",
      key: "0x1ae0",
      value: wire({ ...own, explorer_id: NEIGHBOUR_ARMY, owner: NEIGHBOUR_REALM }),
    },
    {
      model: "TileOccupancy",
      key: "0x1ae1",
      value: wire({ ...stands, ...armyTile, entity_id: NEIGHBOUR_ARMY }),
    },
  ];
  game.store.applyFacts(facts as never);
  const realm = game.store.require("Structure", { game_id: LAB_GAME.gameId, entity_id: NEIGHBOUR_REALM });
  const rules = readExpeditionRules(game.store, LAB_GAME.gameId)!;
  const site = expeditionRealmSite(rules, entityHomeNamespace(NEIGHBOUR_REALM), game.startsAt)!;
  const sharedIn = { chainId: LAB_GAME.chainId.toLowerCase(), gameId: LAB_GAME.gameId, name: "Lab" };
  const owner = { player: NEIGHBOUR, realm: NEIGHBOUR_REALM };
  const shared = (id: string, content: string, place: object) => ({
    id,
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    sender: { playerId: NEIGHBOUR, displayName: "Isolde" },
    content,
    createdAt: new Date().toISOString(),
    metadata: { place: { ...place, game: sharedIn, at: game.startsAt, owner } },
  });
  const messages = [
    shared("far-place-1", "hold here", {
      kind: "structure",
      entityId: NEIGHBOUR_REALM,
      name: getEntityName(NEIGHBOUR_REALM, game.store),
      icon: readStructureMeaning(game.store, realm),
      tile: { col: site.col, row: site.row, alt: false },
    }),
    shared("far-place-2", "my army", {
      kind: "army",
      entityId: NEIGHBOUR_ARMY,
      name: getEntityName(NEIGHBOUR_ARMY, game.store),
      icon: troopMeaning(own.troops),
      tile: armyTile,
    }),
  ];
  return {
    ...game,
    scoped: true,
    chat: (zoneId) => (zoneId === GLOBAL_CHAT_CHANNEL_ID ? messages : []),
  };
};
