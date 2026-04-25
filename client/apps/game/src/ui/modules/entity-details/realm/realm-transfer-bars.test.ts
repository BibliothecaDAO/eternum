// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import type { TransferAutomationEntry } from "@/hooks/store/use-transfer-automation-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";

describe("buildRealmTransferBarModels", () => {
  it("builds minimal live and automation transfer bars for the selected structure", async () => {
    const { buildRealmTransferBarModels } = await import("./realm-transfer-bars");

    const storyEvent = {
      story: "ResourceTransferStory",
      timestampMs: 1_000,
      tx_hash: "0xabc",
      presentation: { title: "Transfer", icon: "resource" },
      id: "story-1",
      resource_transfer_from_entity_id: 209,
      resource_transfer_to_entity_id: 101,
      resource_transfer_resources: JSON.stringify([
        { resourceId: ResourcesIds.Labor, amount: 2356 },
        { resourceId: ResourcesIds.Wood, amount: 100 },
      ]),
      resource_transfer_travel_time: "300",
    } satisfies Partial<ProcessedStoryEvent> as ProcessedStoryEvent;

    const automationEntry: TransferAutomationEntry = {
      id: "automation-1",
      active: true,
      createdAt: 10,
      gameId: "game",
      sourceEntityId: "209",
      sourceName: "Camp 209",
      destinationEntityId: "101",
      destinationName: "Stolsli",
      resourceIds: [ResourcesIds.Labor],
      resourceConfigs: [{ resourceId: ResourcesIds.Labor, amount: 2356 }],
      intervalMinutes: 5,
      lastRunAt: 50,
      nextRunAt: 120,
    };

    const bars = buildRealmTransferBarModels({
      selectedStructureId: 101,
      currentTimeMs: 110_000,
      storyEvents: [storyEvent],
      automationEntries: [automationEntry],
      resolveStructureName: (entityId) => (entityId === 209 ? "Camp 209" : entityId === 101 ? "Stolsli" : null),
    });

    expect(bars.current).toEqual([
      expect.objectContaining({
        kind: "current",
        sourceLabel: "Camp 209",
        destinationLabel: "Stolsli",
        iconResources: ["Labor", "Wood"],
      }),
    ]);
    expect(bars.automation).toEqual([
      expect.objectContaining({
        kind: "automation",
        sourceLabel: "Camp 209",
        destinationLabel: "Stolsli",
        iconResources: ["Labor"],
      }),
    ]);
  });
});
