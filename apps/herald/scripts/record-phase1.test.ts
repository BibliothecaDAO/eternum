import { describe, expect, it } from "vitest";
import {
  assertActionCheckpointCoverage,
  assertSnapshotMatches,
  buildRecording,
  findSnapshotRow,
  hasActorNonceWrite,
  hasRecordingFacts,
  parseOptions,
  snapshotBlock,
} from "./record-phase1";
import type { GameSnapshot } from "../src/types";

const snapshot: GameSnapshot = {
  game_id: "0x2",
  confirmed_block: 20,
  models: [
    { model: "GameRegistry", rows: [{ key: "2", value: { game_id: "0x2", preset_id: "0x5" } }] },
    { model: "GameRelease", rows: [{ key: "2", value: { game_id: "0x2", release_id: "0x3" } }] },
    { model: "Structure", rows: [{ key: "2:9", value: { game_id: "0x2", entity_id: "0x9", owner: "0xa" } }] },
  ],
};

describe("phase-1 recording generator", () => {
  it("keeps every world-scoped row and only this game's game-scoped rows", () => {
    expect(hasRecordingFacts([{ model: { name: "Structure", scope: "game" }, key: { game_id: "0x2" } }], "2")).toBe(
      true,
    );
    expect(
      hasRecordingFacts([{ model: { name: "Preset", scope: "deployment" }, key: { preset_id: "0x67" } }], "2"),
    ).toBe(true);
    expect(hasRecordingFacts([{ model: { name: "Structure", scope: "game" }, key: { game_id: "0x1" } }], "2")).toBe(
      false,
    );
  });

  it("recognizes nonce checkpoints only for the recorded actor and game", () => {
    const nonce = { model: { name: "ActionNonce", scope: "game" }, key: { game_id: "0x2", actor: "0xa" } };
    expect(hasActorNonceWrite([nonce], "2", "0xa")).toBe(true);
    expect(hasActorNonceWrite([nonce], "1", "0xa")).toBe(false);
    expect(hasActorNonceWrite([nonce], "2", "0xb")).toBe(false);
  });

  it("requires at least three transaction-level contract-read checkpoints", () => {
    expect(() => assertActionCheckpointCoverage([])).toThrow("expected at least 3");
    expect(() =>
      assertActionCheckpointCoverage([
        { transactionHash: "0x1", blockNumber: 1 },
        { transactionHash: "0x2", blockNumber: 2 },
      ]),
    ).toThrow("expected at least 3");
    expect(
      assertActionCheckpointCoverage([
        { transactionHash: "0x1", blockNumber: 1 },
        { transactionHash: "0x2", blockNumber: 2 },
        { transactionHash: "0x3", blockNumber: 3 },
      ]),
    ).toBeUndefined();
  });

  it("finds configuration rows when felt fields use Herald's hexadecimal wire form", () => {
    expect(findSnapshotRow(snapshot, "GameRegistry", { game_id: "2" })).toEqual({
      game_id: "0x2",
      preset_id: "0x5",
    });
    expect(findSnapshotRow(snapshot, "GameRelease", { game_id: "0x2" })).toEqual({
      game_id: "0x2",
      release_id: "0x3",
    });
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
    expect(() => assertSnapshotMatches(snapshot, { ...snapshot, models: snapshot.models.slice(0, 2) })).toThrow(
      "Replay snapshot mismatch: missing model Structure",
    );
    expect(() =>
      assertSnapshotMatches(snapshot, {
        ...snapshot,
        models: [
          ...snapshot.models.slice(0, 2),
          { model: "Structure", rows: [{ key: "2:9", value: { game_id: "0x2", entity_id: "0x9", owner: "0xb" } }] },
        ],
      }),
    ).toThrow("Replay snapshot mismatch: Structure row 2:9 differs");
  });

  it("requires explicit endpoints and rejects a guessed final block", () => {
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
        "--output",
        "/tmp/phase1.json",
      ]),
    ).toMatchObject({ gameId: "2", actor: "0xa", fromBlock: 0 });
    expect(() =>
      parseOptions([
        "--rpc-url",
        "rpc",
        "--herald-url",
        "herald",
        "--game-id",
        "2",
        "--actor",
        "0xa",
        "--to-block",
        "99",
        "--output",
        "/tmp/phase1.json",
      ]),
    ).toThrow("Unknown option --to-block");
  });

  it("pins the scan cutoff to the snapshot confirmed block", () => {
    expect(snapshotBlock(snapshot)).toBe(20);
    expect(() => snapshotBlock({ ...snapshot, confirmed_block: -1 })).toThrow("invalid confirmed block");
  });
});
