import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { playerAvatarUrl, resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import { profileOfIdentityUser } from "@realms-world/identity";
import { useMemo } from "react";

import { useChatMap } from "../ui/shared/use-chat-map";
import { useRealtimeChatSelector } from "./use-realtime-chat";

export interface MentionablePlayer {
  name: string;
  portrait: string;
}

/** A name a player could type: none for an unclaimed one, which reads as an address. */
const typable = (name: string | null | undefined): name is string => Boolean(name) && !/^0x[0-9a-f]+$/i.test(name!);

/**
 * Who chat mentions, in a game and in the app alike: the room's own speakers, the players online, and in a game its
 * registered players (useChatMap), each by a claimed name (an unclaimed player has no name to type); and the
 * signed-in player's own name, which marks a message that mentions them. A player never mentions themselves.
 */
export const useChatMentions = (zoneId?: string) => {
  const gamePlayers = useChatMap()?.players;
  const names = usePlayerNames();
  const messages = useRealtimeChatSelector((state) => (zoneId ? state.worldZones[zoneId]?.messages : undefined));
  const online = useRealtimeChatSelector((state) => state.onlinePlayers);
  const self = useRealtimeChatSelector((state) => state.identity?.playerId);
  const user = useIdentitySessionStore((state) => state.session?.user);
  return useMemo(() => {
    const me = user ? profileOfIdentityUser(user).name : null;
    const others = new Map<string, MentionablePlayer>();
    const add = (name: string | null | undefined, portrait: string) => {
      if (!typable(name) || name.toLowerCase() === me?.toLowerCase() || others.has(name)) return;
      others.set(name, { name, portrait });
    };
    for (const player of gamePlayers ?? []) add(player.name, player.portrait);
    for (const { sender } of messages ?? [])
      if (sender.playerId !== self)
        add(
          resolveChatSenderName(names, sender.playerId, sender.displayName),
          sender.avatarUrl ?? playerAvatarUrl(sender.playerId),
        );
    for (const player of Object.values(online))
      if (player.playerId !== self)
        add(resolveChatSenderName(names, player.playerId, player.displayName), playerAvatarUrl(player.playerId));
    const choices = [...others.values()];
    return { me, choices, names: me ? [...others.keys(), me] : [...others.keys()] };
  }, [gamePlayers, messages, online, self, names, user]);
};
