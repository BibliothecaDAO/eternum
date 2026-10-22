import {
  configManager,
  entityMapPosition,
  isCurrentExpeditionArmy,
  Position,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { entityHomeNamespace, expeditionRealmSite } from "@bibliothecadao/eternum/expeditions";
import { getNeighborHexes, getHexDistance, StructureType, TileOccupier } from "@bibliothecadao/types";
import { requireActiveGameClient, startRealmVisit } from "../src/sync/active-game-client";
import { useAccountStore } from "../src/hooks/store/use-account-store";
import { useUIStore } from "../src/hooks/store/use-ui-store";
import { useChainTimeStore } from "../src/hooks/store/use-chain-time-store";
import { nativeTilePackingConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import rowFixture from "../../../contracts/l3/world-native/schema/fixtures/row-set.json";

/**
 * A Shrine and a Well beside a live army on today's map, and a Shrine three tiles off, inside the real, already booted
 * Frontier route: the army's owner is the viewer, with an account that cannot sign, and the site command is recorded
 * instead of sent. Its local answer is the chain's: the used site's tile is emptied. Where no army is out today, one
 * is staged beside a realm of today's map: 1,000 knights holding 40 stamina, owned by that realm.
 */
export function stageFrontierSites() {
  const client = requireActiveGameClient();
  const { store, systemCalls } = client.setup;
  const gameId = configManager.getActiveGameId();
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error("Sites proof requires a Frontier game");
  if (!configManager.isCommandEnabled("InteractSite")) throw new Error("This game allows no site use");
  const now = Math.floor(useChainTimeStore.getState().nowMs / 1000);
  const wire = (value) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? String(field) : field)));
  const write = (model, key, value) => store.applyFacts([{ model, key, value: value && wire(value) }]);
  // A realm's site on today's map is computed, not stored: nothing is staged on one.
  const realmSites = [...store.rows("Structure")]
    .filter((row) => row.game_id === gameId && row.base.category === StructureType.Realm)
    .map((row) => expeditionRealmSite(rules, entityHomeNamespace(row.entity_id), now))
    .filter(Boolean);
  const free = (hex) =>
    !store.get("TileOccupancy", { game_id: gameId, alt: false, col: hex.col, row: hex.row }) &&
    !realmSites.some((site) => site.col === hex.col && site.row === hex.row);
  const live = [...store.rows("ExplorerTroops")].find(
    (row) =>
      row.troops.count > 0n &&
      row.game_id === gameId &&
      isCurrentExpeditionArmy(rules, entityMapPosition(store, gameId, row.explorer_id), now),
  );
  const army = live ?? stageArmy(store, gameId, rules, now, free, write);
  const at = store.entityOccupancy(gameId, army.explorer_id);
  const freeBeside = (hex) => free(hex) && !(hex.col === at.col && hex.row === at.row);
  const beside = getNeighborHexes(at.col, at.row).filter(freeBeside);
  if (beside.length < 2) throw new Error("Sites proof needs two free tiles beside the army");
  const around = (hexes) => hexes.flatMap((hex) => getNeighborHexes(hex.col, hex.row));
  const far = around(around(around([at]))).find((hex) => freeBeside(hex) && getHexDistance(hex, at) === 3);
  if (!far) throw new Error("Sites proof needs a free tile three steps off");
  const home = store.require("Structure", { game_id: gameId, entity_id: army.owner });
  const sites = [
    { kind: "Shrine", hex: beside[0], key: "0x5e5e01", id: 900000101, category: TileOccupier.Shrine },
    { kind: "Well", hex: beside[1], key: "0x5e5e02", id: 900000102, category: TileOccupier.Well },
    { kind: "FarShrine", hex: far, key: "0x5e5e03", id: 900000103, category: TileOccupier.Shrine },
  ];
  for (const site of sites) {
    if (store.get("TileOccupancy", { game_id: gameId, alt: false, ...site.hex }))
      throw new Error("Fixture tile collision");
    const coord = { game_id: gameId, alt: false, col: site.hex.col, row: site.hex.row };
    if (!store.get("TileOpt", coord))
      write("TileOpt", `${site.key}0`, { ...coord, data: 11n * BigInt(nativeTilePackingConstants.BIOME_SCALE) });
    write("TileOccupancy", site.key, { ...coord, entity_id: site.id, category: site.category, is_structure: false });
  }
  const sent = [];
  const owner = `0x${home.owner.toString(16)}`;
  const originalConnect = client.connect;
  const originalVisit = client.visit;
  client.connect = () => undefined;
  client.visit = () => undefined;
  useAccountStore.setState({
    account: {
      address: owner,
      execute: () => {
        throw new Error("The sites fixture cannot sign a transaction");
      },
    },
  });
  startRealmVisit({ player: owner, structureId: Number(army.owner), opensOn: null });
  client.connect = originalConnect;
  client.visit = originalVisit;
  // The route was entered to watch; the owner now plays it, through the HUD's own deliberate exit from watching.
  useUIStore.getState().exitSpectatorMode();
  useUIStore.getState().setStructureEntityId(Number(army.owner), { spectator: false });
  systemCalls.interact_site = async ({ explorer_id, coord }) => {
    const site = sites.find((one) => one.hex.col === Number(coord.x) && one.hex.row === Number(coord.y));
    if (!site) throw new Error("Use did not target a fixture site");
    sent.push({
      kind: site.kind,
      explorerId: Number(explorer_id),
      coord: { alt: coord.alt, x: Number(coord.x), y: Number(coord.y) },
    });
    write("TileOccupancy", site.key, null);
    return { transaction_hash: `0x5e5e${sent.length}` };
  };
  // The recorded use's outcome is the chain's: applied, the site's tile already emptied above.
  const waitForAction = client.waitForAction;
  client.waitForAction = (hash) =>
    /^0x5e5e\d+$/.test(hash)
      ? Promise.resolve({ hash, block: 0, status: "SUCCEEDED" })
      : waitForAction.call(client, hash);
  const normalized = (hex) => Position.fromContract({ x: hex.col, y: hex.row }).getNormalized();
  const position = Position.fromContract({ x: at.col, y: at.row });
  window.dispatchEvent(new CustomEvent("minimapCameraMove", { detail: position }));
  const tiles = { army: at, shrine: sites[0].hex, well: sites[1].hex, far: sites[2].hex };
  return {
    armyId: Number(army.explorer_id),
    staged: !live,
    position,
    /** Centres the map's camera on the army or a site, as the minimap does; returns the tile it aims at. */
    focus(name) {
      const tile = tiles[name];
      window.dispatchEvent(
        new CustomEvent("minimapCameraMove", { detail: Position.fromContract({ x: tile.col, y: tile.row }) }),
      );
      return { x: tile.col, y: tile.row };
    },
    get summary() {
      const now = store.entityOccupancy(gameId, army.explorer_id);
      return {
        gameId,
        armyId: Number(army.explorer_id),
        armyStaged: !live,
        armyTile: { col: now.col, row: now.row, alt: now.alt },
        sites: sites.map((site) => ({
          kind: site.kind,
          tile: site.hex,
          normalized: normalized(site.hex),
          standing: Boolean(store.get("TileOccupancy", { game_id: gameId, alt: false, ...site.hex })),
        })),
        armyNormalized: normalized(at),
        sent,
      };
    },
  };
}

/**
 * A 1,000-knight army holding 40 stamina on revealed grassland beside a realm's site on today's map, owned by that
 * realm.
 */
function stageArmy(store, gameId, rules, now, free, write) {
  for (const realm of store.rows("Structure")) {
    if (realm.game_id !== gameId || realm.base.category !== StructureType.Realm) continue;
    const site = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), now);
    if (!site) continue;
    const tile = getNeighborHexes(site.col, site.row).find(
      (hex) => free(hex) && getNeighborHexes(hex.col, hex.row).filter(free).length >= 3,
    );
    if (!tile) continue;
    const coord = { game_id: gameId, alt: false, col: tile.col, row: tile.row };
    if (!store.get("TileOpt", coord))
      write("TileOpt", "0x5e5e12", { ...coord, data: 11n * BigInt(nativeTilePackingConstants.BIOME_SCALE) });
    const explorerId = 900000201;
    write("ExplorerTroops", "0x5e5e10", {
      game_id: gameId,
      explorer_id: explorerId,
      owner: realm.entity_id,
      troops: {
        ...rowFixture.expected.value.troops,
        count: String(1_000n * 1_000_000_000n),
        stamina: { Inline: { amount: "40", settled_at: String(now), remainder: 0 } },
      },
    });
    write("TileOccupancy", "0x5e5e11", {
      ...coord,
      entity_id: explorerId,
      category: TileOccupier.ExplorerKnightT1,
      is_structure: false,
    });
    return store.require("ExplorerTroops", { game_id: gameId, explorer_id: explorerId });
  }
  throw new Error("Sites proof needs a realm with a site on today's map");
}
