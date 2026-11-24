import type { IconMeaning } from "@/ui/design-system/icon";
import {
  CHAT,
  EVENTS_WORDS,
  RESEARCH,
  SEASON,
  unreadChatMessages,
  unreadFeedEvents,
} from "@/ui/design-system/kit/words";

export type HudPlaceKey = "research" | "season" | "feed" | "chat";

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
  aspectsOpen: boolean;
  researchOpen: boolean;
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

export const resolveHudPlaces = ({
  aspectsOpen,
  researchOpen,
  researchReady,
  feedUnread,
  chatUnread,
  chatOpen = false,
}: HudPlacesState): HudPlaceItem[] =>
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
        return aspectsOpen ? [{ ...place, ariaLabel: place.label }] : [];
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
