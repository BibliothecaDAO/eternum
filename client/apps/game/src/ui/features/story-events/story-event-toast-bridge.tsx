import { useEffect } from "react";

import { buildStoryEventPresentation, storyEventBus } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";

import { AudioManager } from "@/audio/core/AudioManager";

import { useStoryEventToasts } from "./story-event-toast-provider";

export function StoryEventToastBridge() {
  const { pushToast } = useStoryEventToasts();
  const {
    setup: { components },
    account,
  } = useDojo();

  const accountAddress = account?.account?.address;

  useEffect(() => {
    const unsubscribe = storyEventBus.subscribe((event) => {
      const presentation = buildStoryEventPresentation(event, components);
      pushToast(presentation, event);

      // Play sound when own realm is under attack
      if (event.storyType === "BattleStory" && accountAddress) {
        const payload = event.storyPayload as { defender_owner_address?: string } | null;
        const defenderAddress = payload?.defender_owner_address;
        if (defenderAddress && BigInt(defenderAddress) === BigInt(accountAddress)) {
          AudioManager.getInstance().play("combat.under_attack");
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pushToast, components, accountAddress]);

  return null;
}
