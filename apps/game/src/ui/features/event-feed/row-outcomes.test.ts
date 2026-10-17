import { TransactionType } from "@bibliothecadao/provider";
import { expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { Transaction } from "@/hooks/store/use-transaction-store";

vi.mock("@/ui/features/world/components/bottom-right-panel/tile-panel-title", () => ({
  formatTilePanelTitle: (label: string, hex: { col: number; row: number }) => `${label} · (${hex.col}, ${hex.row})`,
}));

import { lostArmyLine, sendOutcome, storyOutcome } from "./row-outcomes";

const grants = () => ({
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 250,
  claimHyperstructureFromBandits: 1000,
});
const story = (kind: string, payload: Record<string, unknown>, title: string, description?: string) =>
  ({ story: kind, storyPayload: payload, presentation: { title, description } }) as unknown as ProcessedStoryEvent;
const explore = (status: Transaction["status"]) =>
  ({ hash: "0x1", type: TransactionType.EXPLORE, status, submittedAt: 0, description: "Scouts sent" }) as Transaction;

it("tells a done explore its points, and leaves a pending or refused one to its status line", () => {
  expect(sendOutcome(explore("success"), grants)).toBe("Explored: +5 points");
  expect(sendOutcome(explore("pending"), grants)).toBeNull();
  expect(sendOutcome(explore("reverted"), grants)).toBeNull();
});

it("tells what an explore found, where, and its points", () => {
  const found = story("ExplorationReward", { coord: { x: 4, y: 6 } }, "+200 Essence");
  expect(storyOutcome(found, grants)).toBe("Explored · (4, 6): +5 points, +200 Essence");
});

it("adds a crate's points, and a capture's points when it paid any", () => {
  expect(storyOutcome(story("RelicChestOpened", {}, "Crate opened: 3 relics to the army Stolsli T1"), grants)).toBe(
    "Crate opened: 3 relics to the army Stolsli T1 · +250 points",
  );
  const camp = story("StructureCapturedStory", { points: 250 }, "clientlane took Camp from The Vanguard");
  expect(storyOutcome(camp, grants)).toBe("clientlane took Camp from The Vanguard · +250 points");
  const realm = story("StructureCapturedStory", { points: 0 }, "a took b from c", "Its armies went with it");
  expect(storyOutcome(realm, grants)).toBe("a took b from c · Its armies went with it");
});

it("tells the viewer the army a fight cost them, and nothing when it stood or was not theirs", () => {
  const fight = (after: string) => ({
    attacker: { player: "0x7", category: "Knight", before: "5000000000000", after: "4000000000000" },
    defender: { player: "0x1", category: "Knight", before: "1000000000000", after },
  });
  expect(lostArmyLine(fight("0"), "0x01")).toBe("Army lost: 1,000 Knights");
  expect(lostArmyLine(fight("1"), "0x1")).toBeNull();
  expect(lostArmyLine(fight("0"), "0x9")).toBeNull();
});
