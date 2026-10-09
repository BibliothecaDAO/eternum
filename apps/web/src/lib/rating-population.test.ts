import { beforeEach, expect, it, vi } from "vitest";
const execute = vi.hoisted(() => vi.fn());
vi.mock("@realms-world/db/client", () => ({ db: { execute } }));
import { readRatingPopulation } from "./rating-population";
beforeEach(() => {
  execute.mockReset();
});
it("returns only holder history and its atomic block watermark, canonicalizing identifiers", async () => {
  execute.mockResolvedValue({ rows: [{ block_number: 77, block_hash: "0x00ABC", players: ["0x0a", "0xa", "0xb"] }] });
  expect(await readRatingPopulation()).toEqual({ block_number: 77, block_hash: "0xabc", players: ["0xa", "0xb"] });
});
it("distinguishes a complete empty population from missing or corrupt index state", async () => {
  execute.mockResolvedValue({ rows: [{ block_number: 77, block_hash: "0xabc", players: [] }] });
  expect((await readRatingPopulation()).players).toEqual([]);
  for (const rows of [
    [],
    [{ block_number: 77, block_hash: null, players: [] }],
    [{ block_number: 77, block_hash: "0xabc", players: ["0x0"] }],
  ]) {
    execute.mockResolvedValue({ rows });
    await expect(readRatingPopulation()).rejects.toThrow("watermark");
  }
  execute.mockRejectedValue(new Error("SQL unavailable"));
  await expect(readRatingPopulation()).rejects.toThrow("unavailable");
});
