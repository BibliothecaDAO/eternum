import Button from "@/ui/design-system/atoms/button";
import { buildStoryEventPresentation, StoryEventSystemUpdate } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useStoryEventToasts } from "./story-event-toast-provider";

const demoEvents: StoryEventSystemUpdate[] = [
  {
    ownerAddress: "0x0123456789abcdef",
    ownerName: null,
    entityId: 42,
    txHash: "0xtx1",
    timestamp: Date.now(),
    storyType: "RealmCreatedStory",
    storyPayload: {
      coord: { x: 120, y: -45 },
    },
    rawStory: {},
  },
  {
    ownerAddress: "0xabcdef0123456789",
    ownerName: null,
    entityId: 77,
    txHash: "0xtx2",
    timestamp: Date.now(),
    storyType: "ProductionStory",
    storyPayload: {
      received_resource_type: 3,
      received_amount: "4800",
      cost: [
        [1, "120"],
        [2, "60"],
      ],
    },
    rawStory: {},
  },
  {
    ownerAddress: "0x9999eeee3333aaaa",
    ownerName: null,
    entityId: 98,
    txHash: "0xtx3",
    timestamp: Date.now(),
    storyType: "BattleStory",
    storyPayload: {
      battle_type: { ExplorerVsExplorer: {} },
      attacker_id: 201,
      defender_id: 310,
      winner_id: 310,
      attacker_troops_lost: "23",
      defender_troops_lost: "19",
    },
    rawStory: {},
  },
];

export function StoryEventToastDebugPanel() {
  const { pushToast, clearAll } = useStoryEventToasts();
  const {
    setup: { components },
  } = useDojo();

  const triggerRandom = () => {
    const sample = demoEvents[Math.floor(Math.random() * demoEvents.length)];
    pushToast(buildStoryEventPresentation(sample, components));
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={triggerRandom}>
        Trigger story toast
      </Button>
      <Button variant="outline" onClick={clearAll}>
        Clear toasts
      </Button>
    </div>
  );
}
