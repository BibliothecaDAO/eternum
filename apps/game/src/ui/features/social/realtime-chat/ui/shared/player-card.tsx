import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";

import { useRealtimeChatActions, useRealtimeChatSelector } from "../../hooks/use-realtime-chat";
import { PlaceChip } from "./chat-map";
import { useChatMap } from "./use-chat-map";
import { UserAvatar } from "./user-avatar";

/**
 * Whether a player is muted, and the press that mutes or unmutes them: the server's block list answers, and a press it
 * did not take is told to the player. The card and a conversation's head press it alike.
 */
export const useMute = (playerId: string) => {
  const actions = useRealtimeChatActions();
  const muted = useRealtimeChatSelector((state) => state.blockedPlayers.includes(playerId));
  const toggle = () =>
    (muted ? actions.unblockPlayer(playerId) : actions.blockPlayer(playerId)).catch((error: unknown) =>
      toast.failed(error, muted ? CHAT_WORDS.unmuteFailed : CHAT_WORDS.muteFailed),
    );
  return { muted, toggle };
};

/**
 * A player's card, opened from their name in a room, under the message it was pressed on: their portrait and name, their
 * realm in this game as a place that opens the map (none outside a game, or for a player with no realm here), Message
 * to write to them privately, and Mute, which hides all they write (Unmute once muted).
 */
export const PlayerCard = ({ playerId, name }: { playerId: string; name: string }) => {
  const actions = useRealtimeChatActions();
  const realm = useChatMap()?.realmOf(playerId) ?? null;
  const { muted, toggle: mute } = useMute(playerId);
  return (
    <li
      aria-label={name}
      data-player-card={playerId}
      className="my-1 flex items-center gap-2 rounded border border-hud-line bg-hud-surface px-2 py-1.5"
    >
      <UserAvatar name={name} address={playerId} size="lg" className="rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-hud-strong text-hud-ink">{name}</p>
        {realm && <PlaceChip place={realm} />}
      </div>
      {!muted && (
        <HudButton kind="secondary" size="sm" onClick={() => actions.openConversation(playerId)}>
          {CHAT_WORDS.message}
        </HudButton>
      )}
      <HudButton kind="secondary" size="sm" onClick={mute}>
        {muted ? CHAT_WORDS.unmute : CHAT_WORDS.mute}
      </HudButton>
    </li>
  );
};
