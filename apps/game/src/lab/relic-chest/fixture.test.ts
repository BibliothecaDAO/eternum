import { expect, it, vi } from "vitest";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import {
  chestStudyGame,
  resetRewardChest,
  expireRewardChest,
  holdChestStudyClock,
  openFixtureChest,
  INITIAL_PACK,
} from "./fixture";

it("keeps a Frontier chest funded beyond fifty seconds until Advance, then resets and restores the clock", () => {
  const store = chestStudyGame(true);
  const running = useChainTimeStore.getState().tick;
  const restore = holdChestStudyClock();
  const time = vi.spyOn(performance, "now");
  const opened: bigint[] = [];
  const stop = store.subscribeEvents((event) => {
    if (event.model === "StoryEvent") {
      const story = event.value.story as { RewardChestOpened?: { amount: bigint } };
      if (story.RewardChestOpened) opened.push(BigInt(story.RewardChestOpened.amount));
    }
  });
  try {
    time.mockReturnValue(performance.now() + 90000);
    useChainTimeStore.getState().tick();
    expect(useChainTimeStore.getState().getNowSeconds()).toBe(350);
    openFixtureChest(store, INITIAL_PACK, true);
    expireRewardChest();
    expect(useChainTimeStore.getState().getNowSeconds()).toBe(400);
    openFixtureChest(store, INITIAL_PACK, true);
    resetRewardChest(store);
    expect(useChainTimeStore.getState().getNowSeconds()).toBe(350);
    openFixtureChest(store, INITIAL_PACK, true);
    expect(opened).toEqual([17n, 0n, 17n]);
  } finally {
    stop();
    time.mockRestore();
    restore();
  }
  expect(useChainTimeStore.getState().tick).toBe(running);
});
