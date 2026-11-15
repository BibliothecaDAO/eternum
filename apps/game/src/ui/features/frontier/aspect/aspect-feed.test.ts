import { expect, it } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { aspectFights, wipedOut } from "./aspect-feed";

const SPACING = 1024;
const store = {
  require: () => ({ spacing: SPACING }),
  get: (_model: string, key: { home: bigint }) => ({ aspect: key.home === 7n ? 1 : 2 }),
} as unknown as NativeFactStore;

const battle = (coord: { x: number; y: number }, winner: number, defenderAfter: string): HeraldHistoryEvent =>
  ({
    block_number: 5,
    transaction_index: 0,
    event_index: 1,
    game_id: "1",
    model: "BattleEvent",
    transaction_hash: "0xabc",
    value: {
      coord: { ...coord, alt: false },
      timestamp: "0x64",
      attacker_id: "0xa",
      defender_id: "0xb",
      attacker_owner: "0x7",
      defender_owner: "0x8",
      winner_id: String(winner),
      attacker: { before: "0x2faf080", after: "0x1dcd6500" },
      defender: { before: "0x2faf080", after: defenderAfter },
    },
  }) as unknown as HeraldHistoryEvent;

it("lists only fights in the Deep, with the winner, and marks the side that kept no troops", () => {
  const deep = { x: 512, y: 3584 };
  const fights = aspectFights(store, 1, [battle(deep, 10, "0x0"), battle({ x: 3, y: 3 }, 10, "0x0")]);
  expect(fights).toHaveLength(1);
  const [fight] = fights;
  expect(fight).toMatchObject({ id: "0xabc:1", at: 100, attackerWon: true });
  expect(fight!.attacker.aspect).not.toBe(fight!.defender.aspect);
  expect(wipedOut(fight!.defender)).toBe(true);
  expect(wipedOut(fight!.attacker)).toBe(false);
});
