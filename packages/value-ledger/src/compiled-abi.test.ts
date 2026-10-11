import { gamesAbi, response } from "../test-support/abi";
import { ledgerAbi } from "../test-support/ledger-abi";
import { describe, expect, it, vi } from "vitest";
import { CallData, type RpcProvider } from "starknet";
import { readLedgerSlot, readLedgerRegistration } from "./blitz-slots";
import {
  decodeBlitzSeason,
  decodeChest,
  decodeChestBand,
  decodeCredits,
  decodeFrontierSeason,
  decodeLedgerPreset,
  decodePlayerResult,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
} from "./codecs";
import { readBlitzRoster } from "./shard-roster";

describe("committed contract readbacks", () => {
  it("reads absent registrations, payments, credits and results as the stored defaults", async () => {
    const callContract = vi.fn().mockResolvedValue(
      response(ledgerAbi, "get_registration", {
        registered: false,
        sword: false,
        shield: false,
        sword_credit: false,
        shield_credit: false,
        paid: { low: 0, high: 0 },
        refundable: false,
        game_id: 0,
        registered_at: 0,
      }),
    );
    expect(
      await readLedgerRegistration(
        { callContract } as unknown as RpcProvider,
        "0x10",
        { chainId: "0x11", slotId: 7 },
        "0x12",
      ),
    ).toEqual({
      registered: false,
      sword: false,
      shield: false,
      swordCredit: false,
      shieldCredit: false,
      paid: 0n,
      refundable: false,
      gameId: 0,
      registeredAt: 0,
    });
    expect(
      decodeWithdrawalPayment(
        response(ledgerAbi, "get_payment", { paid: false, season_id: 0, wallet: 0, amount: { low: 0, high: 0 } }),
      ),
    ).toBeNull();
    expect(decodeCredits(response(ledgerAbi, "get_credits", { swords: 0, shields: 0 }))).toEqual({
      swords: 0,
      shields: 0,
    });
    expect(
      decodePlayerResult(
        response(ledgerAbi, "get_player_result", {
          rank: 0,
          chest_id: { low: 0, high: 0 },
          mmr_before: 0,
          mmr_after: 0,
        }),
      ),
    ).toEqual({ rank: 0, chestId: 0n, mmrBefore: 0, mmrAfter: 0 });
  });
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
      registered_at: 90,
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
      registeredAt: 90,
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
  it("reads the preset calendar immediately after the compiled rating parameters", () => {
    const fields = response(ledgerAbi, "get_preset", {
      entry_fee: { low: 11, high: 1 },
      protocol_cut_bps: 1000,
      chest_lords_bps: 2000,
      paid_fraction_bps: 3000,
      decay_bps: 4000,
      sword_price: { low: 12, high: 2 },
      shield_price: { low: 13, high: 3 },
      mmr: { enabled: true, mean: 1000, spread: 200, max_delta: 45, k: 32, regression_bps: 150 },
      day_unit_seconds: 60,
      claim_window_seconds: 3600,
    });
    expect(decodeLedgerPreset(fields)).toEqual({
      entryFee: String(11n + (1n << 128n)),
      protocolCut: 1000,
      chestLords: 2000,
      paidFraction: 3000,
      decay: 4000,
      swordPrice: String(12n + (2n << 128n)),
      shieldPrice: String(13n + (3n << 128n)),
      dayUnit: 60,
      claimWindow: 3600,
    });
    expect(() => decodeLedgerPreset([...fields.slice(0, 16), "6", ...fields.slice(16)])).toThrow(
      "invalid_ledger_preset",
    );
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
      decodeChestBand(
        response(ledgerAbi, "get_chest_band", {
          metadata: 9,
          odds: {
            common: 4000,
            uncommon: 2500,
            rare: 1500,
            epic: 700,
            legendary: 300,
            lords: 500,
            sword: 250,
            shield: 250,
          },
          lords_shares: 4,
        }),
      ),
    ).toEqual({ lordsOdds: 500, lordsShares: 4 });
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
