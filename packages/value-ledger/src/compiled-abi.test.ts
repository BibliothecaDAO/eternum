import { gamesAbi, response } from "../test-support/abi";
import { ledgerAbi } from "../test-support/ledger-abi";
import { describe, expect, it, vi } from "vitest";
import { CallData, type RpcProvider } from "starknet";
import { readLedgerSlot, readLedgerRegistration } from "./blitz-slots";
import {
  decodeBlitzSeason,
  decodeChest,
  decodeFrontierSeason,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
} from "./codecs";
import { readBlitzRoster } from "./shard-roster";

describe("committed contract readbacks", () => {
  it("reads the complete slot using the compiled field order, including high pool limbs", async () => {
    const fields = response(ledgerAbi, "get_slot", {
      season_id: 3,
      exists: true,
      preset_id: 9,
      close: 100,
      end: 160,
      pool: { low: 7, high: 2 },
      registered_count: 5,
      cancelled: false,
    });
    const callContract = vi.fn().mockResolvedValue(fields);
    expect(
      await readLedgerSlot({ callContract } as unknown as RpcProvider, "0x10", { chainId: "0x11", slotId: 7 }, 20),
    ).toEqual({
      seasonId: 3,
      exists: true,
      presetId: 9,
      close: 100,
      end: 160,
      pool: String(7n + (2n << 128n)),
      registeredCount: 5,
      cancelled: false,
    });
    expect(callContract.mock.calls[0][0].calldata.map(BigInt)).toEqual(
      new CallData(ledgerAbi).compile("get_slot", { key: { shard: 17, slot_id: 7 } }).map(BigInt),
    );
  });
  it("reads one registration with the committed input and output layouts", async () => {
    const fields = response(ledgerAbi, "get_registration", {
      registered: true,
      sword: false,
      shield: true,
      sword_credit: false,
      shield_credit: true,
      paid: { low: 7, high: 2 },
      refundable: true,
      game_id: 19,
    });
    const callContract = vi.fn().mockResolvedValue(fields);
    const provider = { callContract } as unknown as RpcProvider;
    expect(await readLedgerRegistration(provider, "0x10", { chainId: "0x11", slotId: 7 }, "0x12")).toEqual({
      registered: true,
      sword: false,
      shield: true,
      swordCredit: false,
      shieldCredit: true,
      paid: 7n + (2n << 128n),
      refundable: true,
      gameId: 19,
    });
    expect(callContract).toHaveBeenCalledTimes(1);
    expect(callContract.mock.calls[0][1]).toBe("latest");
    expect(callContract.mock.calls[0][0].calldata.map(BigInt)).toEqual(
      new CallData(ledgerAbi).compile("get_registration", { key: { shard: 17, slot_id: 7 }, owner: 18 }).map(BigInt),
    );
    for (const malformed of [
      fields.slice(1),
      [...fields, "0"],
      fields.map((field, index) => (index === 0 ? "2" : field)),
      fields.map((field, index) => (index === 6 ? String(2n ** 128n) : field)),
    ]) {
      callContract.mockResolvedValue(malformed);
      await expect(readLedgerRegistration(provider, "0x10", { chainId: "0x11", slotId: 7 }, "0x12")).rejects.toThrow();
    }
  });
  it("decodes economic records serialized by the compiled ledger types", () => {
    expect(
      decodeBlitzSeason(
        response(ledgerAbi, "get_season", {
          chest_reserve: { low: 2, high: 0 },
          participant_count: 4,
          top_count: 2,
          posted: true,
          challenged: false,
          review_until: 500,
          settlement_started: true,
          paid: { low: 1, high: 0 },
          exists: true,
          preset_id: 9,
          start: 60,
          end: 300,
          pool: { low: 7, high: 2 },
        }),
      ),
    ).toMatchObject({
      participantCount: 4,
      topCount: 2,
      posted: true,
      challenged: false,
      reviewUntil: 500,
      settlementStarted: true,
      presetId: 9,
      start: 60,
      end: 300,
      pool: String(7n + (2n << 128n)),
    });
    expect(decodeSeasonWinner(response(ledgerAbi, "get_season_winner", { 0: 17, 1: { low: 7, high: 2 } }))).toEqual({
      wallet: "17",
      share: 7n + (2n << 128n),
    });
    expect(
      decodeWithdrawalPayment(
        response(ledgerAbi, "get_payment", { paid: true, season_id: 3, wallet: 17, amount: { low: 7, high: 2 } }),
      ),
    ).toEqual({ paid: true, seasonId: 3, wallet: "17", amount: String(7n + (2n << 128n)) });
    expect(
      decodeChest(
        response(ledgerAbi, "get_chest", {
          exists: true,
          season_id: 3,
          band: 2,
          requested: true,
          finished: false,
          requester: 17,
          request_block: 20,
        }),
      ),
    ).toEqual({ seasonId: 3, band: 2, requested: true, finished: false, requester: "17", requestBlock: 20 });
    expect(
      decodeFrontierSeason(
        response(ledgerAbi, "get_frontier", {
          funded: true,
          start: 60,
          end: 300,
          pool: { low: 7, high: 2 },
          paid: { low: 1, high: 0 },
          closed: false,
          preset_id: 9,
          seed: 22,
        }),
      ),
    ).toMatchObject({
      configured: true,
      start: 60,
      end: 300,
      pool: String(7n + (2n << 128n)),
      paid: "1",
      closed: false,
      presetId: 9,
      seed: "22",
    });
  });
  it("reads the Games roster serialized by its compiled player type", async () => {
    const callContract = vi.fn().mockResolvedValue(
      response(gamesAbi, "blitz_roster", [
        { account: 17, wallet: 18 },
        { account: 19, wallet: 20 },
      ]),
    );
    expect(await readBlitzRoster({ callContract } as unknown as RpcProvider, "0x10", 7, 20)).toEqual([
      { account: "17", wallet: "18" },
      { account: "19", wallet: "20" },
    ]);
  });
});
