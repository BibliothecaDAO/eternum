import { expect, it } from "vitest";

import type { DirectoryGame } from "../herald";
import { decodeChest, decodePlayerResult, openChestCalls } from "../value/ledger";
import { bandOf, gameLedgerOf, type Reward, rewardState } from "./reward";

const WEI = 10n ** 18n;

it("reads a result and a chest in the interface's order, and opens a chest with the holder's two calls", () => {
  // PlayerResult: rank, points, chest_id (2), mmr_before, mmr_after.
  expect(decodePlayerResult(["3", "2570", "41", "0", "1744", "1780"])).toEqual({
    rank: 3,
    points: 2570n,
    chestId: 41n,
    mmrBefore: 1744,
    mmrAfter: 1780,
  });
  // Chest: exists, opened, content { kind, cosmetic, lords (2) }.
  expect(decodeChest(["1", "0", "0", "0x4040d01", "0", "0"])).toEqual({
    opened: false,
    content: { kind: "cosmetic", attributes: "0x4040d01" },
  });
  expect(decodeChest(["1", "1", "3", "0", String(700n * WEI), "0"]).content).toEqual({
    kind: "lords",
    amount: 700n * WEI,
  });
  expect(decodeChest(["1", "0", "2", "0", "0", "0"]).content).toEqual({ kind: "shield" });
  expect(() => decodeChest(["1", "0", "9", "0", "0", "0"])).toThrow("Unknown chest kind 9");
  expect(openChestCalls("0xledger", "0xchest", 41n)).toEqual([
    { contractAddress: "0xchest", entrypoint: "approve", calldata: ["0xledger", "41", "0"] },
    { contractAddress: "0xledger", entrypoint: "open_chest", calldata: ["41", "0"] },
  ]);
});

it("places a rank in its band, the one fact a sealed chest shows", () => {
  // rewards.html 3b at 24 players: ranks 1-3 top 10%, 4-6 the 10-25% band, 7-12, 13-18, 19-24.
  expect([1, 3, 4, 6, 7, 12, 13, 18, 19, 24].map((rank) => bandOf(rank, 24))).toEqual([
    "top",
    "top",
    "upper",
    "upper",
    "middle",
    "middle",
    "lower",
    "lower",
    "bottom",
    "bottom",
  ]);
  expect(bandOf(1, 1)).toBe("top");
});

it("waits for the results, then offers a held chest, names a missing fee, a chest gone, and what one held", () => {
  const reward = (overrides: Partial<Reward>): Reward => ({
    result: { rank: 3, points: 2570n, chestId: 41n, mmrBefore: 1744, mmrAfter: 1780 },
    chest: { opened: false, content: { kind: "sword" } },
    held: true,
    registration: { registered: true, sword: true, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
    strk: 10n ** 17n,
    ...overrides,
  });
  expect(
    rewardState(reward({ result: { rank: 0, points: 0n, chestId: 0n, mmrBefore: 0, mmrAfter: 0 }, chest: null })),
  ).toBe("pending");
  expect(rewardState(reward({}))).toBe("sealed");
  expect(rewardState(reward({ strk: 0n }))).toBe("no-strk");
  expect(rewardState(reward({ held: false }))).toBe("traded");
  expect(rewardState(reward({ chest: { opened: true, content: { kind: "sword" } }, held: false }))).toBe("opened");
});

it("reads the ledger a finished game was played on, and none for a game the directory names none for", () => {
  const game = (ledger: unknown) => ({ chainId: "0x52", game_id: 7, ledger }) as unknown as DirectoryGame;
  expect(gameLedgerOf(game(undefined))).toBeNull();
  expect(gameLedgerOf(game({ address: "0xl", chest: "0xc" }))).toEqual({
    address: "0xl",
    chest: "0xc",
    key: { shard: "0x52", gameId: 7 },
  });
});
