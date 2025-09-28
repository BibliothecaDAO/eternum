import { useEffect } from "react";

import { buildStoryEventPresentation, storyEventBus } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";

import { useStoryEventToasts } from "./story-event-toast-provider";

export function StoryEventToastBridge() {
  const { pushToast } = useStoryEventToasts();
  const {
    setup: { components },
  } = useDojo();

  useEffect(() => {
    const unsubscribe = storyEventBus.subscribe((event) => {
      const presentation = buildStoryEventPresentation(event, components);
      pushToast(presentation);
    });

    return () => {
      unsubscribe();
    };
  }, [pushToast, components]);

  return null;
}
