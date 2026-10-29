import { createContext, useContext } from "react";

import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import type { SharedPlace } from "../../model/place";

/**
 * The map as chat reads it, where a map is: the place selected on it, to share; and a place a message carries as the
 * map reads it now. Its name and painting are the map's where the map holds it (a message cannot rename a place), else
 * the message's; it opens nothing once gone (an army that fell, a site taken away) or from a Frontier day that has
 * closed. Outside a game there is no map: a place reads as the message has it, and opens nothing.
 */
export interface ChatMap {
  selected: SharedPlace | null;
  read: (place: SharedPlace) => { name: string; icon: IconMeaning; open: (() => void) | null };
}

export const ChatMapContext = createContext<ChatMap | null>(null);

export const useChatMap = () => useContext(ChatMapContext);
