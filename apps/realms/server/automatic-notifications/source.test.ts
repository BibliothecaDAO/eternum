import { expect, it, vi } from "vitest";
import { endOfStoryBlock } from "@bibliothecadao/eternum/game-sync";
import { createNotificationSource } from "./source";
import { resolveAutomaticNotificationConfig } from "./config";
const config = { url: "https://herald.test", chain: "madara", worldAddress: "0x123" };
const event = {
  block_number: 11,
  transaction_index: 0,
  event_index: 0,
  game_id: "7",
  model: "StoryEvent",
  transaction_hash: "0x1",
  value: { game_id: "0x7" },
};
const page = {
  chain: "madara",
  world_address: "0x123",
  complete_through_block: 11,
  next_cursor: endOfStoryBlock(11),
  items: [event],
};
it("uses bounded confirmed-history requests and rejects scope changes, disorder, and progress regression", async () => {
  const request = vi.fn().mockResolvedValue(Response.json(page));
  const source = createNotificationSource(config, request);
  expect((await source.page(endOfStoryBlock(10))).items).toHaveLength(1);
  expect(String(request.mock.calls[0]![0])).toContain("after=10%3A2147483647%3A2147483647");
  for (const invalid of [
    { ...page, world_address: "0x999" },
    { ...page, items: [event, event] },
    { ...page, next_cursor: endOfStoryBlock(9) },
    { ...page, complete_through_block: 10 },
  ]) {
    request.mockResolvedValueOnce(Response.json(invalid));
    await expect(source.page(endOfStoryBlock(10))).rejects.toThrow();
  }
});
it("fails on unavailable sources and validates the enabled source configuration", async () => {
  await expect(
    createNotificationSource(config, vi.fn().mockResolvedValue(new Response(null, { status: 503 }))).page(null),
  ).rejects.toThrow("503");
  expect(resolveAutomaticNotificationConfig({})).toBeNull();
  expect(() => resolveAutomaticNotificationConfig({ WEB_PUSH_AUTOMATIC_ENABLED: "true" })).toThrow();
  expect(
    resolveAutomaticNotificationConfig({
      WEB_PUSH_ENABLED: "true",
      WEB_PUSH_AUTOMATIC_ENABLED: "true",
      NOTIFICATION_HERALD_URL: config.url,
      NOTIFICATION_CHAIN: "madara",
      NOTIFICATION_WORLD_ADDRESS: "0x0123",
    }),
  ).toEqual(config);
});

it("rejects directory metadata from another world during a backend switch", async () => {
  const source = createNotificationSource(
    config,
    vi.fn().mockResolvedValue(Response.json({ chain: "madara", world_address: "0x999", games: [] })),
  );
  await expect(source.games()).rejects.toThrow();
});
