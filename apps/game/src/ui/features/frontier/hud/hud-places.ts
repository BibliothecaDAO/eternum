import type { IconMeaning } from "@/ui/design-system/icon";
import {
  CHAT,
  EVENTS_WORDS,
  RELIC_WORDS,
  RESEARCH,
  SEASON,
  unreadChatMessages,
  unreadFeedEvents,
} from "@/ui/design-system/kit/words";

export type HudPlaceKey = "season" | "research" | "feed" | "chat" | "relics";

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
  relicsOpen: boolean;
  researchReady?: boolean;
  feedUnread: number;
  chatUnread: number;
  chatOpen?: boolean;
  relics?: number;
  hasRealm?: boolean;
}

export const HUD_PLACES = [
  { key: "season", label: SEASON, icon: "victory" },
  { key: "research", label: RESEARCH, icon: "research" },
  { key: "feed", label: EVENTS_WORDS.feed, icon: "chronicles" },
  { key: "relics", label: RELIC_WORDS.title, icon: "relics" },
  { key: "chat", label: CHAT, icon: "chat" },
] as const satisfies readonly { key: HudPlaceKey; label: string; icon: IconMeaning }[];

export const resolveHudPlaces = ({
  aspectsOpen,
  researchOpen,
  relicsOpen,
  researchReady,
  feedUnread,
  chatUnread,
  chatOpen = false,
  relics = 0,
  hasRealm = true,
}: HudPlacesState): HudPlaceItem[] =>
  HUD_PLACES.flatMap((place): HudPlaceItem[] => {
    switch (place.key) {
      case "season":
        return aspectsOpen ? [{ ...place, ariaLabel: place.label }] : [];
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
      case "feed":
        return [
          {
            ...place,
            ariaLabel: place.label,
            count: feedUnread > 0 ? feedUnread : undefined,
            countLabel: feedUnread > 0 ? unreadFeedEvents(feedUnread) : undefined,
          },
        ];
      case "relics":
        return hasRealm && relicsOpen
          ? [
              {
                ...place,
                ariaLabel: place.label,
                count: relics > 0 ? relics : undefined,
              },
            ]
          : [];
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

export const resolveMenuPlaces = (state: HudPlacesState): HudPlaceItem[] =>
  resolveHudPlaces(state).filter((place) => place.key !== "season");
