import { expect, it } from "vitest";

import { openChestCalls } from "../value/ledger";
import { entryMultipleOf, type Reward, rewardState } from "./reward";

const WEI = 10n ** 18n;
const WALLET = "0x4a1";

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
    collection: "0xc4e57",
    chest,
    held: true,
    content: null,
    drawBlocksLeft: null,
    seasonEnd: 0,
    token: { shares: 4, entryFee: 100n * WEI },
    registration: {
      registered: true,
      sword: true,
      shield: false,
      swordCredit: false,
      shieldCredit: false,
      paid: 0n,
      refundable: false,
      gameId: 0,
      registeredAt: 0,
    },
    ...overrides,
  });
  const requested = { ...chest, requested: true, requester: WALLET, requestBlock: 812300 };
  expect(
    rewardState(reward({ result: { rank: 0, chestId: 0n, mmrBefore: 0, mmrAfter: 0 }, chest: null }), WALLET),
  ).toBe("pending");
  expect(rewardState(reward({}), WALLET)).toBe("sealed");
  // The waiting state is read from the chain, so it is the same after leaving and coming back.
  expect(rewardState(reward({ chest: requested, held: false }), WALLET)).toBe("opening");
  expect(rewardState(reward({ chest: { ...requested, finished: true }, held: false }), WALLET)).toBe("opened");
  expect(rewardState(reward({ held: false }), WALLET)).toBe("traded");
  // Opened by whoever bought it: gone from this player.
  expect(rewardState(reward({ chest: { ...requested, requester: "0xb0b" }, held: false }), WALLET)).toBe("traded");
});

it("counts a token reward in entries of its slot, whatever the entry costs", () => {
  expect(entryMultipleOf(400n * WEI, 100n * WEI)).toBe(4);
  expect(entryMultipleOf(500n * WEI, 500n * WEI)).toBe(1);
  // No entry fee divides these: the sum stands alone.
  expect(entryMultipleOf(700n * WEI, 500n * WEI)).toBeNull();
  expect(entryMultipleOf(700n * WEI, 0n)).toBeNull();
});
