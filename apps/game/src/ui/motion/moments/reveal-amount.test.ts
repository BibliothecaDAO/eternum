import { expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));
const { rises } = vi.hoisted(() => ({ rises: [] as Array<{ label: string }> }));
vi.mock("@/ui/motion/motion-layer", () => ({
  flySprites: () => undefined,
  riseSprite: (rise: { label: string }) => rises.push(rise),
}));
vi.mock("@/three/sound/utils", () => ({ getResourceSoundId: (id: number) => `collect.${id}` }));

const { buildStoryEventPresentation, configManager, WorldUpdateListener } = await import("@bibliothecadao/eternum");
const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
const { ResourcesIds } = await import("@bibliothecadao/types");
const { playRevealYield } = await import("@/ui/motion/moments/reveal-yield");

const PAYOUT = 57_600_000_000n;

const revealStory = (amount: bigint) => ({
  explorer_id: 7,
  receiver: 5,
  coord: { alt: false, x: 1, y: 1 },
  resource_type: ResourcesIds.Essence,
  amount: String(amount),
});

it("writes a reveal's fractional pay the same on its tile as in the Log, from the story's contract amount", () => {
  configManager.setActiveGame(1);
  const store = new NativeFactStore();
  const listener = new WorldUpdateListener({ store } as never);
  const stop = listener.ExplorerReward.onExplorerRewardEventUpdate(({ resourceId, amount }) => {
    if (resourceId) playRevealYield({ resourceId, amount, from: { x: 0, y: 0 }, own: true, now: 1_000 });
  });
  store.applyEvent({
    model: "StoryEvent",
    key: "0x1",
    value: { game_id: "0x1", timestamp: "0x1", owner: "0x1", story: { ExplorationReward: revealStory(PAYOUT) } },
  } as never);
  stop();

  const log = buildStoryEventPresentation({
    storyType: "ExplorationReward",
    storyPayload: revealStory(PAYOUT),
    entityId: null,
    ownerAddress: "0x1",
    viewerAddress: null,
  } as never).title;

  expect(log).toBe("Explored: +58 Essence");
  expect(rises.map(({ label }) => label)).toEqual(["+58"]);
});

it("keeps a reveal's fraction until the day's total is written", async () => {
  const { totalToday } = await import("@/ui/features/frontier/log/today-totals");
  const fiveReveals = Array.from({ length: 5 }, () => ({
    story: "ExplorationReward",
    storyPayload: { resource_type: ResourcesIds.Essence, amount: String(PAYOUT) },
    owner: "0x1",
    timestampMs: 1_000,
  }));
  expect(totalToday(fiveReveals, "0x1", { startMs: 0, endMs: 2_000 }).essence).toBe(288);
});

it("reads the season's earned Essence exactly, for the one rounding", async () => {
  const { earnedResource } = await import("@/ui/features/frontier/board/standings");
  expect(earnedResource(String(PAYOUT))).toBe(57.6);
});
