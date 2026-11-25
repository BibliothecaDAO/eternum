import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));
vi.mock("@/ui/motion/motion-layer", () => ({ flySprites: () => undefined, riseSprite: () => undefined }));
vi.mock("@/three/sound/utils", () => ({ getResourceSoundId: (id: number) => `collect.${id}` }));

const { buildStoryEventPresentation, configManager, WorldUpdateListener } = await import("@bibliothecadao/eternum");
const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
const { ResourcesIds } = await import("@bibliothecadao/types");
const { playRevealYield } = await import("@/ui/motion/moments/reveal-yield");
const { clearRevealGains } = await import("@/ui/motion/moments/reveal-gains");
const { RevealPill } = await import("./reveal-pill");

const PAYOUT = 57_600_000_000n;

const revealStory = (amount: bigint) => ({
  explorer_id: 7,
  receiver: 5,
  coord: { alt: false, x: 1, y: 1 },
  resource_type: ResourcesIds.Essence,
  amount: String(amount),
});

it("writes a reveal's fractional pay the same on its pill as in the Log, from the story's contract amount", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  configManager.setActiveGame(1);
  const store = new NativeFactStore();
  const listener = new WorldUpdateListener({ store } as never);
  const stop = listener.ExplorerReward.onExplorerRewardEventUpdate(({ resourceId, amount }) => {
    if (resourceId) playRevealYield({ resourceId, amount, from: { x: 0, y: 0 }, own: true, now: 1_000 });
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<RevealPill />));
  act(() =>
    store.applyEvent({
      model: "StoryEvent",
      key: "0x1",
      value: { game_id: "0x1", timestamp: "0x1", owner: "0x1", story: { ExplorationReward: revealStory(PAYOUT) } },
    } as never),
  );
  const pill = host.querySelector("[data-reveal-pill]")?.textContent;
  act(() => root.unmount());
  act(() => clearRevealGains());
  stop();
  host.remove();

  const log = buildStoryEventPresentation({
    storyType: "ExplorationReward",
    storyPayload: revealStory(PAYOUT),
    entityId: null,
    ownerAddress: "0x1",
    viewerAddress: null,
  } as never).title;

  expect(log).toBe("Explored: +58 Essence");
  expect(pill).toBe("+58");
});

it("writes the same 57.6 reveal on Today's line, and keeps its fraction until the day's total is written", async () => {
  const { dayLogLine } = await import("../log/day-line");
  const { totalToday } = await import("../log/today-totals");
  const storyPayload = revealStory(PAYOUT);
  const presentation = buildStoryEventPresentation({
    storyType: "ExplorationReward",
    storyPayload,
    entityId: null,
    ownerAddress: "0x1",
    viewerAddress: null,
  } as never);
  const { frontierDay } = await import("../deploy/deploy-fixture");
  const { store } = frontierDay();
  expect(dayLogLine({ story: "ExplorationReward", storyPayload, presentation } as never, store)).toBe("+58 Essence");

  const fiveReveals = Array.from({ length: 5 }, () => ({
    story: "ExplorationReward",
    storyPayload: { resource_type: ResourcesIds.Essence, amount: String(PAYOUT) },
    owner: "0x1",
    timestampMs: 1_000,
  }));
  expect(totalToday(fiveReveals, "0x1", { startMs: 0, endMs: 2_000 }).essence).toBe(288);
});

it("reads the season's earned Essence exactly, for the one rounding", async () => {
  const { earnedResource } = await import("../board/standings");
  expect(earnedResource(String(PAYOUT))).toBe(57.6);
});
