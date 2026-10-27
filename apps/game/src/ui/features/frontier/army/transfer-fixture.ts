import { getNeighborHexes } from "@bibliothecadao/types";
import { campBeside } from "../sites/site-fixture";

const TRANSFER_PICKED = { col: 41, row: 12 };
export const TRANSFER_TAPPED = getNeighborHexes(41, 12)[0]!;
export const transferArmies = (pickedXp = 0, tappedXp = 99) => {
  const { store } = campBeside();
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const facts = [
    {
      model: "ArmyProgressionRules",
      key: "0xf1",
      value: {
        game_id: 1,
        reveal_xp: 2,
        fixed_xp: 200,
        uncommon_xp: 100,
        rare_xp: 200,
        epic_xp: 400,
        legendary_xp: 800,
      },
    },
    ...[201, 202].flatMap((id, slot) => [
      {
        model: "ExplorerTroops",
        key: slot === 0 ? "0x74" : "0x92",
        value: {
          ...first,
          explorer_id: id,
          troops: { ...first.troops, count: BigInt(slot === 0 ? 600 : 500) * 1_000_000_000n, stamina: { Slot: slot } },
        },
      },
      {
        model: "ArmyProgress",
        key: `0xf${id}2`,
        value: {
          game_id: 1,
          explorer_id: id,
          xp: slot === 0 ? pickedXp : tappedXp,
          battle: 1,
          logistics: slot === 0 ? 2 : 1,
          scouting: 1,
          homecoming: 1,
          scouting_kinds: 0,
        },
      },
      {
        model: "ArmySlot",
        key: slot === 0 ? "0x9" : "0xf2023",
        value: {
          game_id: 1,
          structure_id: 7,
          epoch: "0",
          slot,
          explorer_id: id,
          stamina: { amount: slot === 0 ? "7" : "100", settled_at: "350", remainder: 0 },
        },
      },
      {
        model: "TileOccupancy",
        key: slot === 0 ? "0x75" : "0x93",
        value: {
          game_id: 1,
          entity_id: id,
          col: slot === 0 ? TRANSFER_PICKED.col : TRANSFER_TAPPED.col,
          row: slot === 0 ? TRANSFER_PICKED.row : TRANSFER_TAPPED.row,
          alt: false,
          category: 26,
          is_structure: false,
        },
      },
    ]),
  ];
  store.applyFacts(
    JSON.parse(JSON.stringify(facts, (_, value) => (typeof value === "bigint" ? value.toString() : value))),
  );
  return store;
};

/** The reported 500 into 1,500 transfer: 222 total XP against 20 unspent XP, with logistics on both armies. */
export const transferXpArmies = () => {
  const store = transferArmies(22, 20);
  store.applyFacts([{ model: "ArmySlot", key: "0xf2023", value: null }]);
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const facts = [
    { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, level: 1 } } },
    ...[201, 202].flatMap((id, index) => {
      const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: id });
      const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: id });
      const slot = index === 0 ? 0 : 2;
      return [
        {
          model: "ExplorerTroops",
          key: index === 0 ? "0x74" : "0x92",
          value: {
            ...army,
            troops: {
              ...army.troops,
              count: BigInt(index === 0 ? 500 : 1500) * 1_000_000_000n,
              stamina: { Slot: slot },
            },
          },
        },
        {
          model: "ArmyProgress",
          key: `0xf${id}2`,
          value: { ...progress, logistics: 2, homecoming: index === 0 ? 2 : 1 },
        },
        {
          model: "ArmySlot",
          key: index === 0 ? "0x9" : "0xf2024",
          value: {
            game_id: 1,
            structure_id: 7,
            epoch: "0",
            slot,
            explorer_id: id,
            stamina: { amount: index === 0 ? "5" : "15", settled_at: "350", remainder: 0 },
          },
        },
      ];
    }),
  ];
  store.applyFacts(
    JSON.parse(JSON.stringify(facts, (_, value) => (typeof value === "bigint" ? value.toString() : value))),
  );
  return store;
};
