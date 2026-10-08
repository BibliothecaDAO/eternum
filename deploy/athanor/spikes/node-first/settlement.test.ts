import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CallData } from "starknet";
import { readClassArtifact } from "../../../../config/deployer/clean/shared/declare";
import { readSettledHome, settleCloseFootprint } from "./settlement";

test("settle observation pins owner, native economy and home namespace", () => {
  const good = ["131073", "0x123", "2", "0", "4294967293", "4294967295", "0", "96", "16", "1"];
  expect(readSettledHome(good, "0x123", "Y", "2").valid).toBe(true);
  expect(readSettledHome(good, "0x456", "Y", "2").valid).toBe(false);
  expect(readSettledHome(good, "0x123", "Y", "3").valid).toBe(false);
  expect(readSettledHome(["2", ...good.slice(1)], "0x123", "Y", "2").valid).toBe(false);
  expect(readSettledHome([...good.slice(0, 9), "0"], "0x123", "X", "0").valid).toBe(false);
});
test("footprint includes final close once and refuses partial or contaminated coverage", () => {
  const dir = mkdtempSync(join(tmpdir(), "settle-log-")),
    file = join(dir, "log.jsonl");
  const close = (block: number, count: number) => ({
    message: "close_block_complete",
    block_number: block,
    tx_count: count,
    event_count: count * 20,
    state_diff_len: count * 51,
    nonce_updates: count,
    bouncer_state_diff_size: count * 90,
    l2_gas_consumed: count * 100000,
  });
  try {
    writeFileSync(
      file,
      [
        close(1, 1000),
        { message: "close_block_complete block_number=1", tx_count: 1000 },
        close(2, 1000),
        close(2, 1000),
        close(3, 0),
      ]
        .map((v) => JSON.stringify(v))
        .join("\n"),
    );
    const result = settleCloseFootprint(file, 0, 2000);
    expect(result.complete).toBe(true);
    expect(result.eventsPerSettle).toBe(20);
    expect(result.storageEntriesPerSettle).toBe(50);
    expect(result.blocks.length).toBe(2);
    expect(settleCloseFootprint(file, 0, 3000).complete).toBe(false);
    expect(settleCloseFootprint(file, 0, 1000).contaminated).toBe(true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("published settle ABI encodes one direct action and no selected-realm bypass", () => {
  const artifact = readClassArtifact(
    join(import.meta.dir, "artifacts-game/node_first_game_SettleGames.contract_class.json"),
    join(import.meta.dir, "artifacts-game/node_first_game_SettleGames.compiled_contract_class.json"),
  );
  const codec = new CallData(artifact.sierra.abi);
  expect(codec.compile("settle_season", { game: 1, name: "0x123" })).toEqual(["1", "291"]);
  expect(codec.compile("assign_seats", { game: 2, actors: ["0x123", "0x456"] })).toEqual(["2", "2", "291", "1110"]);
});
