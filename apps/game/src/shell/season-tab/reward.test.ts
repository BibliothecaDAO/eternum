import { expect, it } from "vitest";

import type { DirectoryGame } from "../herald";
import { decodeChest, decodeChestContent, decodePlayerResult, openChestCalls } from "../value/ledger";
import { gameLedgerOf, type Reward, rewardState } from "./reward";

const WEI = 10n ** 18n;
const WALLET = "0x4a1";

it("reads a result, a band chest and what an opened one delivered, in the interface's order", () => {
  // PlayerResult: rank, chest_id (2), mmr_before, mmr_after.
  expect(decodePlayerResult(["3", "41", "0", "1744", "1780"])).toEqual({
    rank: 3,
    chestId: 41n,
    mmrBefore: 1744,
    mmrAfter: 1780,
  });
  // Chest: exists, season_id, band, requested, finished, requester, request_block.
  expect(decodeChest(["1", "3", "0", "1", "0", WALLET, "812300"])).toEqual({
    seasonId: 3,
    band: 0,
    requested: true,
    finished: false,
    requester: WALLET,
    requestBlock: 812300,
  });
  // ChestContent (the ChestOpened event's data): kind, cosmetic, lords (2).
  expect(decodeChestContent(["0", "0x4040d01", "0", "0"])).toEqual({ kind: "cosmetic", attributes: "0x4040d01" });
  expect(decodeChestContent(["3", "0", String(700n * WEI), "0"])).toEqual({ kind: "lords", amount: 700n * WEI });
  expect(decodeChestContent(["2", "0", "0", "0"])).toEqual({ kind: "shield" });
  expect(() => decodeChestContent(["9", "0", "0", "0"])).toThrow("Unknown chest kind 9");
});

it("opens with the holder's one signature: approve the ledger, then the irreversible request", () => {
  expect(openChestCalls("0xledger", "0xchest", 41n)).toEqual([
    { contractAddress: "0xchest", entrypoint: "approve", calldata: ["0xledger", "41", "0"] },
    { contractAddress: "0xledger", entrypoint: "open_request", calldata: ["41", "0"] },
  ]);
});

it("waits for the results, offers a held chest, waits on the draw after the request, then shows what it delivered", () => {
  const chest = { seasonId: 3, band: 0, requested: false, finished: false, requester: "0x0", requestBlock: 0 };
  const reward = (overrides: Partial<Reward>): Reward => ({
    result: { rank: 3, chestId: 41n, mmrBefore: 1744, mmrAfter: 1780 },
    chest,
    held: true,
    content: null,
    seasonEnd: 0,
    registration: { registered: true, sword: true, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
    strk: 10n ** 17n,
    ...overrides,
  });
  const requested = { ...chest, requested: true, requester: WALLET, requestBlock: 812300 };
  expect(
    rewardState(reward({ result: { rank: 0, chestId: 0n, mmrBefore: 0, mmrAfter: 0 }, chest: null }), WALLET),
  ).toBe("pending");
  expect(rewardState(reward({}), WALLET)).toBe("sealed");
  expect(rewardState(reward({ strk: 0n }), WALLET)).toBe("no-strk");
  // The waiting state is read from the chain, so it is the same after leaving and coming back.
  expect(rewardState(reward({ chest: requested, held: false }), WALLET)).toBe("opening");
  expect(rewardState(reward({ chest: { ...requested, finished: true }, held: false }), WALLET)).toBe("opened");
  expect(rewardState(reward({ held: false }), WALLET)).toBe("traded");
  // Opened by whoever bought it: gone from this player.
  expect(rewardState(reward({ chest: { ...requested, requester: "0xb0b" }, held: false }), WALLET)).toBe("traded");
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
