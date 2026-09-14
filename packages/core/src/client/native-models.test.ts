import { describe, expect, it, vi } from "vitest";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import { HeraldGameSyncTransport, type HeraldSocket } from "../sync/herald-game-sync-transport";
import { nativeModelDefinition } from "./native-models";

describe("native event routing", () => {
  it("delivers battle ephemera, persistent participants and the following transaction without reconnecting", async () => {
    const socket: HeraldSocket = {
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: vi.fn(),
      close: vi.fn(),
    };
    const transport = new HeraldGameSyncTransport({
      url: "ws://herald.test/madara/games/7",
      socketFactory: () => socket,
      modelDefinition: nativeModelDefinition(bindings as unknown as NativeWorldBindings),
    });
    const onEvent = vi.fn();
    const onEntityBatch = vi.fn();
    const onTransaction = vi.fn();
    const subscription = transport.subscribe({ onEntity: vi.fn(), onEvent, onEntityBatch, onTransaction });
    const receive = (value: unknown) => socket.onmessage!({ data: JSON.stringify(value) });
    receive({ type: "hello", epoch: "test", seq: 0, confirmed_block: 1, preconfirmed_block: 2 });
    const writer = await subscription;
    receive({ type: "snapshot_end", epoch: "test", seq: 0 });
    receive({
      type: "diff",
      epoch: "test",
      seq: 1,
      block: 2,
      preconfirmed: true,
      transaction_hash: "0x123",
      set: [
        {
          model: "BattleEvent",
          key: "0x91",
          value: { game_id: "7", attacker_id: "10", defender_id: "11", timestamp: "100" },
        },
        {
          model: "LastBattle",
          key: "0x92",
          value: { game_id: "7", entity_id: "10", latest_defender_id: "11", latest_defense_timestamp: "100" },
        },
      ],
      del: [{ model: "ExplorerTroops", key: "0x93" }],
    });
    receive({ type: "tx", epoch: "test", seq: 2, block: 2, hash: "0x123", status: "PRE_CONFIRMED" });
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEntityBatch).toHaveBeenCalledOnce();
    expect(
      onEntityBatch.mock.calls[0][0].entities.map((entity: { models: object }) => Object.keys(entity.models)),
    ).toEqual([["LastBattle"], ["ExplorerTroops"]]);
    expect(onTransaction).toHaveBeenCalledWith({ block: 2, hash: "0x123", status: "PRE_CONFIRMED" });
    expect(socket.close).not.toHaveBeenCalled();
    writer.cancel();
  });
});
