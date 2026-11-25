import type { IconMeaning } from "@/ui/design-system/icon";

import { usePartShown } from "../opening/opening-context";
import {
  CHAT,
  EVENTS_WORDS,
  RESEARCH,
  SEASON,
  unreadChatMessages,
  unreadFeedEvents,
} from "@/ui/design-system/kit/words";

type HudPlaceKey = "research" | "season" | "feed" | "chat";

interface HudPlaceItem {
  key: HudPlaceKey;
  label: string;
  icon: IconMeaning;
  ariaLabel: string;
  count?: number;
  countLabel?: string;
  countTone?: "good";
}

interface HudPlacesState {
  researchReady?: boolean;
  feedUnread: number;
  chatUnread: number;
  chatOpen?: boolean;
}

export const HUD_PLACES = [
  { key: "research", label: RESEARCH, icon: "research" },
  { key: "season", label: SEASON, icon: "victory" },
  { key: "feed", label: EVENTS_WORDS.feed, icon: "chronicles" },
  { key: "chat", label: CHAT, icon: "chat" },
] as const satisfies readonly { key: HudPlaceKey; label: string; icon: IconMeaning }[];

export const useHudPlaces = (state: HudPlacesState): HudPlaceItem[] =>
  resolveHudPlaces(state, usePartShown("research"));

const resolveHudPlaces = (
  { researchReady, feedUnread, chatUnread, chatOpen = false }: HudPlacesState,
  researchOpen: boolean,
): HudPlaceItem[] =>
  HUD_PLACES.flatMap((place): HudPlaceItem[] => {
    switch (place.key) {
      case "research":
        return researchReady !== undefined && researchOpen
          ? [
              {
                ...place,
                ariaLabel: place.label,
                count: researchReady ? 1 : undefined,
                countTone: "good",
              },
            ]
          : [];
      case "season":
        return [{ ...place, ariaLabel: place.label }];
      case "feed":
        return [
          {
            ...place,
            ariaLabel: place.label,
            count: feedUnread > 0 ? feedUnread : undefined,
            countLabel: feedUnread > 0 ? unreadFeedEvents(feedUnread) : undefined,
          },
        ];
      case "chat":
        return [
          {
            ...place,
            ariaLabel: place.label,
            count: !chatOpen && chatUnread > 0 ? chatUnread : undefined,
            countLabel: chatUnread > 0 ? unreadChatMessages(chatUnread) : undefined,
          },
        ];
    }
  });
