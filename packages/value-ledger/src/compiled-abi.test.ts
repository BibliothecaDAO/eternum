import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CallData, type Abi, type RpcProvider } from "starknet";
import { readLedgerSlot } from "./blitz-slots";
import {
  decodeBlitzSeason,
  decodeChest,
  decodeFrontierSeason,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
} from "./codecs";
import { readBlitzRoster } from "./shard-roster";

const ledgerPath = new URL(
  "../../../contracts/l2/ledger/target/dev/game_ledger_GameLedger.contract_class.json",
  import.meta.url,
);
const gamesPath = new URL(
  "../../../contracts/l3/world-native/target/dev/world_native_Games.contract_class.json",
  import.meta.url,
);

// The landing gate supplies compiled artifacts; ordinary source-only checkouts skip this contract check.
describe.skipIf(!existsSync(ledgerPath) || !existsSync(gamesPath))("compiled contract readbacks", () => {
  function response(path: URL, entrypoint: string, value: unknown) {
    const abi = JSON.parse(readFileSync(path, "utf8")).abi as Abi;
    const entries = abi.flatMap((item) => (item.type === "interface" ? item.items : [item]));
    const entry = entries.find((item) => item.type === "function" && item.name === entrypoint)!;
    const codec = new CallData([
      ...abi,
      {
        type: "function",
        name: "serialize_readback",
        inputs: [{ name: "value", type: entry.outputs[0].type }],
        outputs: [],
        state_mutability: "view",
      },
    ]);
    return codec.compile("serialize_readback", { value } as never);
  }
  it("reads the complete slot using the compiled field order, including high pool limbs", async () => {
    const fields = response(ledgerPath, "get_slot", {
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
    const abi = JSON.parse(readFileSync(ledgerPath, "utf8")).abi;
    expect(callContract.mock.calls[0][0].calldata.map(BigInt)).toEqual(
      new CallData(abi).compile("get_slot", { key: { shard: 17, slot_id: 7 } }).map(BigInt),
    );
  });
  it("decodes economic records serialized by the compiled ledger types", () => {
    expect(
      decodeBlitzSeason(
        response(ledgerPath, "get_season", {
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
    expect(decodeSeasonWinner(response(ledgerPath, "get_season_winner", { 0: 17, 1: { low: 7, high: 2 } }))).toEqual({
      wallet: "17",
      share: 7n + (2n << 128n),
    });
    expect(
      decodeWithdrawalPayment(
        response(ledgerPath, "get_payment", { paid: true, season_id: 3, wallet: 17, amount: { low: 7, high: 2 } }),
      ),
    ).toEqual({ paid: true, seasonId: 3, wallet: "17", amount: String(7n + (2n << 128n)) });
    expect(
      decodeChest(
        response(ledgerPath, "get_chest", {
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
        response(ledgerPath, "get_frontier", {
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
      response(gamesPath, "blitz_roster", [
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
