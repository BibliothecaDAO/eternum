import { describe, expect, it } from "vitest";
import { assertSnapshotMatches, buildRecording, hasRecordingFacts, parseOptions } from "./record-phase1";
import type { GameSnapshot } from "../src/types";

const snapshot: GameSnapshot = {
  game_id: "2",
  confirmed_block: 20,
  models: [{ model: "Structure", rows: [{ key: "2:9", value: { game_id: "2", entity_id: "9", owner: "0xa" } }] }],
};

describe("phase-1 recording generator", () => {
  it("classifies decoded game rows and the registered preset, excluding unrelated game rows", () => {
    expect(hasRecordingFacts([{ model: { name: "Structure", scope: "game" }, key: { game_id: 2 } }], "2", "5")).toBe(
      true,
    );
    expect(
      hasRecordingFacts([{ model: { name: "Preset", scope: "deployment" }, key: { preset_id: 5 } }], "2", "5"),
    ).toBe(true);
    expect(hasRecordingFacts([{ model: { name: "Structure", scope: "game" }, key: { game_id: 1 } }], "2", "5")).toBe(
      false,
    );
    expect(
      hasRecordingFacts([{ model: { name: "Preset", scope: "deployment" }, key: { preset_id: 4 } }], "2", "5"),
    ).toBe(false);
  });

  it("keeps the replay fixture shape and rejects a missing or changed snapshot row loudly", () => {
    const record = {
      transaction: { type: "INVOKE", transaction_hash: "0x12", calldata: ["0x1"] },
      receipt: {
        transaction_hash: "0x12",
        block_number: 20,
        execution_status: "SUCCEEDED",
        finality_status: "ACCEPTED_ON_L2",
        events: [],
      },
    };
    const recording = buildRecording({
      sourceHead: "a".repeat(40),
      schemaIdentity: "schema-id",
      worldAddress: "0x1",
      actor: "0xa",
      gameId: "2",
      records: [record],
      checks: [{ kind: "FinalState", transactionHash: "0x12", nonce: "0x3", playerPoints: "0x0" }],
      finalSnapshot: snapshot,
    });
    expect(Object.keys(recording)).toEqual([
      "sourceHead",
      "schemaIdentity",
      "worldAddress",
      "actor",
      "gameId",
      "records",
      "checks",
      "finalSnapshot",
    ]);
    expect(recording.records).toEqual([record]);
    expect(() => assertSnapshotMatches(snapshot, { ...snapshot, models: [] })).toThrow(
      "Replay snapshot mismatch: missing model Structure",
    );
    expect(() =>
      assertSnapshotMatches(snapshot, {
        ...snapshot,
        models: [{ model: "Structure", rows: [{ key: "2:9", value: { game_id: "2", entity_id: "9", owner: "0xb" } }] }],
      }),
    ).toThrow("Replay snapshot mismatch: Structure row 2:9 differs");
  });

  it("requires explicit endpoints and supports a bounded final block", () => {
    expect(
      parseOptions([
        "--rpc-url",
        "http://127.0.0.1:28340/rpc/v0_10_2",
        "--herald-url",
        "http://127.0.0.1:28341",
        "--game-id",
        "2",
        "--actor",
        "0x0a",
        "--to-block",
        "99",
        "--output",
        "/tmp/phase1.json",
      ]),
    ).toMatchObject({ gameId: "2", actor: "0xa", fromBlock: 0, toBlock: 99 });
  });
});
