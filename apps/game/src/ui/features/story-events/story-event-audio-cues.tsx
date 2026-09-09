import { AudioManager } from "@/audio/core/AudioManager";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { feltEquals } from "@/runtime/world/herald-http";
import { battleIdentity, involvesPlayer } from "@/ui/features/event-feed/important-feed-rows";
import { useEffect, useRef } from "react";

/** Combat feedback is sound only; the persistent battle row belongs to Events. */
export function StoryEventAudioCues() {
  const { data: events = [] } = useStoryEvents(350);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const previous = seen.current;
    seen.current = new Set(events.map(battleIdentity));
    if (!previous) return;
    const address = useAccountStore.getState().account?.address ?? null;
    for (const event of events) {
      const key = battleIdentity(event);
      if (event.story !== "BattleStory" || previous.has(key)) continue;
      previous.add(key);
      if (Date.now() - event.timestampMs > 20_000 || !involvesPlayer(event, address)) continue;
      const payload = event.storyPayload;
      const ownerId = feltEquals(payload.attacker_owner_address, address)
        ? payload.attacker_owner_id
        : payload.defender_owner_id;
      const won = feltEquals(payload.winner_id, ownerId) && !feltEquals(payload.winner_id, 0);
      AudioManager.getInstance().play(won ? "combat.victory" : "combat.defeat");
    }
  }, [events]);
  return null;
}
