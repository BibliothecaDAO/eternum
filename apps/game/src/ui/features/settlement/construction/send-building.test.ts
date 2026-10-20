import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BuildingType } from "@bibliothecadao/types";
import { expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ place: vi.fn(), outcome: vi.fn() }));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({ actions: { placeBuilding: client.place }, waitForAction: client.outcome }),
}));

import { isPlotInFlight, sendBuilding } from "./send-building";

const farm = (plot = { col: 11, row: 10 }) => ({
  realmId: 7,
  type: BuildingType.ResourceWheat,
  plot,
  useSimpleCost: false,
});

it("holds a plot until the game applied its building: a second send to it sends nothing", async () => {
  let applied!: () => void;
  client.place.mockResolvedValue({ transaction_hash: "0xb1" });
  client.outcome.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        applied = () => resolve({ status: "SUCCEEDED" });
      }),
  );
  const first = sendBuilding(farm());
  await vi.waitFor(() => expect(client.outcome).toHaveBeenCalledOnce());
  expect(isPlotInFlight(7, { col: 11, row: 10 })).toBe(true);
  expect(await sendBuilding(farm())).toBeNull();
  expect(client.place).toHaveBeenCalledOnce();
  applied();
  expect(await first).toBe("0xb1");
  expect(isPlotInFlight(7, { col: 11, row: 10 })).toBe(false);
});

it("frees the plot with the game's reason when it refused the building", async () => {
  client.place.mockResolvedValue({ transaction_hash: "0xb2" });
  client.outcome.mockResolvedValueOnce({ status: "REVERTED", revertReason: "building location occupied" });
  await expect(sendBuilding(farm({ col: 12, row: 10 }))).rejects.toThrow("building location occupied");
  expect(isPlotInFlight(7, { col: 12, row: 10 })).toBe(false);
});

/** Every source in the client, tests left out. */
const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

it("sends a building from this module only: no surface sends one that is not held until its outcome", () => {
  const root = join(__dirname, "../../../..");
  const senders = sources(root)
    .filter((path) => /\bactions\.placeBuilding\(/.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path));
  expect(senders).toEqual(["ui/features/settlement/construction/send-building.ts"]);
});
