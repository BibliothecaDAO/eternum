import { expect, it } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { aspectFights, readDeepFightWindow, wipedOut } from "./aspect-feed";

const SPACING = 1024;
const DEEP = { x: 512, y: 3584 };
const store = {
  require: () => ({ spacing: SPACING }),
  get: (_model: string, key: { home: bigint }) => ({ aspect: key.home === 7n ? 1 : key.home === 8n ? 2 : undefined }),
} as unknown as NativeFactStore;

const hex = (troops: number) => `0x${(BigInt(troops) * BigInt(RESOURCE_PRECISION)).toString(16)}`;

/** A BattleEvent as the contract emits it: owners are homes (0 for a site's beast), winner_id what its emitter fills. */
const battle = (
  shape: {
    attackerOwner?: number;
    defenderOwner?: number;
    winner: number;
    attacker: [number, number];
    defender: [number, number];
    at?: { x: number; y: number };
  },
  index = 1,
): HeraldHistoryEvent =>
  ({
    block_number: 5,
    transaction_index: 0,
    event_index: index,
    game_id: "1",
    model: "BattleEvent",
    transaction_hash: "0xabc",
    value: {
      coord: { ...(shape.at ?? DEEP), alt: false },
      timestamp: "0x64",
      attacker_id: "0xa",
      defender_id: "0xb",
      attacker_owner: String(shape.attackerOwner ?? 7),
      defender_owner: String(shape.defenderOwner ?? 8),
      winner_id: String(shape.winner),
      attacker: { before: hex(shape.attacker[0]), after: hex(shape.attacker[1]) },
      defender: { before: hex(shape.defender[0]), after: hex(shape.defender[1]) },
    },
  }) as unknown as HeraldHistoryEvent;

it("tells each fight by the troops each side kept, whatever its emitter wrote as the winner", () => {
  const [wins, loses, standoff, mutual] = aspectFights(store, 1, [
    // The attacker's home 7 wipes the defender: winner_id is the winning home, which is not the army id 10.
    battle({ winner: 7, attacker: [100, 80], defender: [60, 0] }, 1),
    // A guard attack lost: its emitter writes the site's entity id as the winner.
    battle({ winner: 800, attacker: [100, 0], defender: [60, 20] }, 2),
    battle({ winner: 0, attacker: [100, 70], defender: [60, 30] }, 3),
    battle({ winner: 0, attacker: [50, 0], defender: [50, 0] }, 4),
  ]).fights;
  expect([wins, loses, standoff, mutual].map((fight) => fight!.outcome)).toEqual([
    "attacker",
    "defender",
    "standoff",
    "mutual",
  ]);
  expect(wins!.attacker).toMatchObject({ aspect: "Prowess", before: 100, after: 80 });
  expect(wins!.defender).toMatchObject({ aspect: "Luminary", before: 60, after: 0 });
  expect(wipedOut(wins!.defender)).toBe(true);
  expect(wipedOut(wins!.attacker)).toBe(false);
});

it("leaves out a site's neutral beast and a fight outside the Deep, and counts a fight it cannot name", () => {
  const { fights, unnamed } = aspectFights(store, 1, [
    battle({ defenderOwner: 0, winner: 7, attacker: [100, 90], defender: [10_000, 9_000] }, 1),
    battle({ winner: 7, attacker: [100, 80], defender: [60, 0], at: { x: 3, y: 3 } }, 2),
    battle({ defenderOwner: 99, winner: 7, attacker: [100, 80], defender: [60, 0] }, 3),
    battle({ winner: 7, attacker: [100, 80], defender: [60, 0] }, 4),
  ]);
  expect(fights.map(({ id }) => id)).toEqual(["0xabc:4"]);
  expect(unnamed).toBe(1);
});

it("reads pages until the window holds enough Deep fights, however many fights elsewhere come first", async () => {
  const elsewhere = (index: number) =>
    battle({ winner: 7, attacker: [10, 5], defender: [10, 0], at: { x: 3, y: 3 } }, index);
  const pages = [
    Array.from({ length: 3 }, (_, index) => elsewhere(index)),
    Array.from({ length: 3 }, (_, index) => elsewhere(10 + index)),
    [battle({ winner: 7, attacker: [100, 80], defender: [60, 0] }, 20)],
  ];
  const read = async (offset: number) => ({ items: pages[offset / 3] ?? [], total: 7 });
  const window = await readDeepFightWindow(read, SPACING, 1, 3);
  expect(aspectFights(store, 1, window).fights.map(({ id }) => id)).toEqual(["0xabc:20"]);
  // A history that ends first returns what it has, and a failed page is the caller's to show.
  expect(await readDeepFightWindow(read, SPACING, 5, 3)).toHaveLength(7);
  await expect(
    readDeepFightWindow(() => Promise.reject(new Error("history unavailable")), SPACING, 1, 3),
  ).rejects.toThrow("history unavailable");
});
