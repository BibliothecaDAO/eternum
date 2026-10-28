import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { playerAvatarUrl, usePlayers } from "@/hooks/use-player-profile";
import { profileOfIdentityUser } from "@realms-world/identity";
import { useMemo } from "react";

export interface MentionablePlayer {
  name: string;
  portrait: string;
}

/**
 * Who chat mentions: the game's registered players with a claimed name (an unclaimed player has no name to type), and
 * the signed-in player's own name, which marks a message that mentions them. A player never mentions themselves.
 */
export const useChatMentions = () => {
  const players = usePlayers();
  const user = useIdentitySessionStore((state) => state.session?.user);
  return useMemo(() => {
    const me = user ? profileOfIdentityUser(user).name : null;
    const others = new Map<string, MentionablePlayer>();
    for (const player of players) {
      if (player.name === null || player.name.toLowerCase() === me?.toLowerCase()) continue;
      others.set(player.name, { name: player.name, portrait: playerAvatarUrl(player.address, player) });
    }
    const choices = [...others.values()];
    return { me, choices, names: me ? [...others.keys(), me] : [...others.keys()] };
  }, [players, user]);
};
