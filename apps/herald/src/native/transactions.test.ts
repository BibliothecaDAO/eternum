import { CallData, hash } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { NativeLiveWorld as LiveWorld } from "./live-world";
import type { MadaraRpc } from "../madara-rpc";
import { WorldEventDecodeMonitor } from "../world-event-decoder";
import { manifest, receipt, schema, setup } from "./fixtures";
import { transactionGameIds } from "./transactions";

function call(game: number, entrypoint = "execute") {
  const abi = [...Object.values(schema.types), ...schema.domains.season.entrypoints];
  const codec = new CallData(abi);
  const calldata = codec.compile(entrypoint, {
    intent: {
      chain: 1,
      deployment: manifest.world.address,
      game_id: game,
      actor: "0x111",
      nonce: 0,
      valid_from: 2000,
      valid_until: 3000,
      last_order: 1,
      rules: 1,
      command: 1,
      arguments: [2, 1],
    },
    context: { envelope: [], authority_epoch: 1, accepted_public_key: 1 },
    r: 1,
    s: 2,
  });
  return [manifest.world.address, hash.getSelectorFromName(entrypoint), String(calldata.length), ...calldata];
}

describe("native transaction receipt routing", () => {
  it("uses the authenticated intent's game for every action call", () => {
    const calldata = ["3", ...call(1), ...call(2, "execute"), ...call(1)];
    expect(transactionGameIds(manifest, calldata)).toEqual(["1", "2"]);
    expect(() => transactionGameIds(manifest, ["1", ...call(1).slice(0, -1)])).toThrow();
    expect(() => transactionGameIds(manifest, ["1", ...call(1), "0"])).toThrow();
    expect(() => transactionGameIds(manifest, ["invalid"])).toThrow();
    const foreign = call(1);
    foreign[0] = "0x999";
    expect(transactionGameIds(manifest, ["1", ...foreign])).toEqual([]);
  });
  it("delivers a reverted receipt received before its sequencer-submitted transaction", () => {
    const { native, decoder, fold } = setup();
    const messages: Record<string, unknown>[] = [];
    const live = new LiveWorld({
      native,
      registry: decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: vi.fn() },
      confirmedBlock: 9,
      confirmedFold: fold,
      rpc: {} as MadaraRpc,
      decodeMonitor: new WorldEventDecodeMonitor(),
    });
    const connection = live.attach("1", { send: (value) => messages.push(JSON.parse(value)) });
    live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
    messages.length = 0;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      live.acceptTransaction({ finality_status: "PRE_CONFIRMED", transaction_hash: "0xbad", calldata: ["invalid"] }),
    ).not.toThrow();
    expect(native.routingFailures).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("herald_native_transaction_routing_failed"));
    log.mockRestore();
    live.acceptReceipt({ ...receipt([], "0x123"), execution_status: "REVERTED", revert_reason: "invalid command" });
    expect(messages).toEqual([]);
    live.acceptTransaction({
      finality_status: "PRE_CONFIRMED",
      transaction_hash: "0x123",
      sender_address: "0x999",
      calldata: ["1", ...call(1)],
    });
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages[0])).toContain("REVERTED");
    expect(fold.retainedRowCount()).toBe(0);
  });
});
