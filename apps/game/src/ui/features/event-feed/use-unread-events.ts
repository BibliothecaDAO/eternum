import { useEffect, useRef, useState } from "react";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { involvesPlayer } from "./important-feed-rows";
import { useFeedRows } from "./use-feed-rows";

export function useUnreadEvents(visible: boolean): number {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const { data: stories } = useStoryEvents(350, "BattleStory");
  const feed = useFeedRows();
  const since = useRef(Date.now());
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const ids = [
    ...stories
      .filter((event) => event.timestampMs >= since.current && involvesPlayer(event, address))
      .map((event) => event.id),
    ...feed.recent
      .filter((row) => row.kind === "transaction" && row.transaction.status === "reverted" && row.at >= since.current)
      .map((row) => row.id),
  ];
  const key = ids.join("|");
  useEffect(() => {
    if (visible) setSeen(new Set(key ? key.split("|") : []));
  }, [visible, key]);
  return visible ? 0 : ids.filter((id) => !seen.has(id)).length;
}
