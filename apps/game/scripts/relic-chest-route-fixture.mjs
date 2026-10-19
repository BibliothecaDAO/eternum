import { configManager, dayOf, Position, readExpeditionRules } from "@bibliothecadao/eternum";
import { getNeighborHexes, TileOccupier } from "@bibliothecadao/types";
import { requireActiveGameClient } from "../src/sync/active-game-client";
import { useChestOpeningStore } from "../src/hooks/store/use-chest-opening-store";
import { useAccountStore } from "../src/hooks/store/use-account-store";
import { nativeTilePackingConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { useChainTimeStore } from "../src/hooks/store/use-chain-time-store";

/** Local reward facts and a non-signing transport inside the real, already booted Frontier route. */
export function stageFrontierChest() {
  const client = requireActiveGameClient();
  const { store, systemCalls } = client.setup;
  const gameId = configManager.getActiveGameId();
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error("Chest route proof requires a Frontier game");
  const army = [...store.rows("ExplorerTroops")].find(
    (row) => row.troops.count > 0n && store.entityOccupancy(gameId, row.explorer_id)?.alt === false,
  );
  if (!army) throw new Error("Chest route proof needs a visible surface army");
  const beside = store.entityOccupancy(gameId, army.explorer_id);
  const hex = getNeighborHexes(beside.col, beside.row).find(
    (candidate) => !store.get("TileOccupancy", { game_id: gameId, ...candidate, alt: false }),
  );
  if (!hex) throw new Error("Chest route proof needs an unoccupied neighbouring hex");
  const home = store.require("Structure", { game_id: gameId, entity_id: army.owner });
  const now = Math.floor(useChainTimeStore.getState().nowMs / 1000);
  const day = dayOf(rules, now);
  if (!day) throw new Error("Chest route proof needs an active Frontier day");
  const chestId = 900000001;
  if (store.get("SiteChest", { game_id: gameId, entity_id: chestId })) throw new Error("Fixture ID collision");
  const coord = { game_id: gameId, alt: false, col: hex.col, row: hex.row };
  const terrain = store.get("TileOpt", coord);
  const tileKey = "0xcce501";
  const chestKey = "0xcce502";
  const wire = (value) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? String(field) : field)));
  const write = (model, key, value) => store.applyFacts([{ model, key, value: wire(value) }]);
  let sends = 0;
  const reset = () => {
    useChestOpeningStore.setState({ openings: {} });
    useChainTimeStore.getState().anchor({ timestamp: now * 1000 });
    if (!terrain) write("TileOpt", tileKey, { ...coord, data: 15n * BigInt(nativeTilePackingConstants.BIOME_SCALE) });
    write("TileOccupancy", tileKey, {
      ...coord,
      entity_id: chestId,
      category: TileOccupier.Chest,
      is_structure: false,
    });
    fund();
  };
  const fund = () =>
    write("SiteChest", chestKey, {
      game_id: gameId,
      entity_id: chestId,
      tier: 0,
      amount: 17,
      reservation_day: day.index,
    });
  const originalConnect = client.connect;
  client.connect = () => undefined;
  useAccountStore.setState({
    account: {
      address: `0x${home.owner.toString(16)}`,
      execute: () => {
        throw new Error("The chest route fixture cannot sign a transaction");
      },
    },
  });
  client.connect = originalConnect;
  systemCalls.open_chest = async ({ explorer_id, chest_coord }) => {
    if (explorer_id !== Number(army.explorer_id) || chest_coord.x !== hex.col || chest_coord.y !== hex.row)
      throw new Error("Open did not target the fixture chest with its adjacent army");
    sends += 1;
    const current = Math.floor(useChainTimeStore.getState().nowMs / 1000);
    const amount = dayOf(rules, current)?.index === day.index ? 17 : 0;
    write("TileOccupancy", tileKey, null);
    store.applyEvent({
      model: "StoryEvent",
      key: `0xcce6${sends}`,
      value: {
        game_id: gameId,
        timestamp: current,
        story: {
          RewardChestOpened: {
            explorer_id,
            structure_id: Number(army.owner),
            coord: { alt: false, x: hex.col, y: hex.row },
            amount,
          },
        },
      },
    });
  };
  reset();
  const normalized = Position.fromContract({ x: hex.col, y: hex.row }).getNormalized();
  window.dispatchEvent(new CustomEvent("minimapCameraMove", { detail: { col: normalized.x, row: normalized.y } }));
  return {
    hex,
    reset,
    fund,
    missing: () => write("SiteChest", chestKey, null),
    rollover: () => useChainTimeStore.getState().anchor({ timestamp: day.end * 1000 }),
    get sends() {
      return sends;
    },
    get summary() {
      return { gameId, armyId: Number(army.explorer_id), chestId, hex, sends };
    },
  };
}
