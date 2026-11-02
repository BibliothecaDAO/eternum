import { type PlayerNames, usePlayerNames } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { useRealmsAccountOf } from "@/shell/herald";
import { useMemo } from "react";

/**
 * Chat names its players by their Realms id, while identity keys every name and portrait by the player's account on our
 * shards. This reader is chat's one way from the one to the other, so a name or a portrait in chat is the identity
 * profile's, as the Season board, Results and the header draw it, and lands when that profile does.
 */
interface ChatPeople {
  /** The player's account on our shards; none until the guardian answers, or for a sender with no Realms id. */
  accountOf: (playerId: string) => string | null;
  /** The player's claimed name; the chat server's display name until identity has answered, never an address. */
  nameOf: (playerId: string, displayName?: string | null) => string;
  /** The player's portrait as identity has it: their chosen one, else their account's stock one; none until known. */
  portraitOf: (playerId: string) => string | null;
}

const isHex = (value: string): boolean => /^0x[0-9a-fA-F]+$/.test(value);

export const useChatPeople = (): ChatPeople => {
  const accountOf = useRealmsAccountOf();
  const names = usePlayerNames();
  return useMemo(() => chatPeople(accountOf, names), [accountOf, names]);
};

const chatPeople = (realmsAccountOf: (realmsId: string) => string | null, names: PlayerNames): ChatPeople => {
  const accountOf = (playerId: string) => (isHex(playerId) ? realmsAccountOf(playerId) : null);
  return {
    accountOf,
    nameOf: (playerId, displayName) => {
      // The chat server stores the sender's address as their display name when they had none; that never shows.
      const serverName = displayName?.trim() && !isHex(displayName.trim()) ? displayName.trim() : null;
      const account = accountOf(playerId);
      if (!account) return serverName ?? playerId;
      const reading = names.reading(account);
      return reading.state === "named" && reading.claimed ? reading.text : (serverName ?? reading.text);
    },
    portraitOf: (playerId) => {
      const account = accountOf(playerId);
      if (!account) return null;
      const profile = names.profile(account);
      return profile.known ? playerPortraitUrl(account, profile.portrait) : null;
    },
  };
};
