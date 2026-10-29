import { resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import { HudButton, HudChip, HudRow } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { useRealtimeChatActions, useRealtimeChatSelector } from "../../hooks/use-realtime-chat";
import { threadUnread } from "../../model/direct-unread";
import { whenSent } from "../../model/message-grouping";
import { useMute } from "../shared/player-card";
import { UserAvatar } from "../shared/user-avatar";

/**
 * Messages: the player's private conversations, the latest first, each by the other player's name with its last line,
 * and what is unread in it, else when it was last written. A press opens it. A conversation with nothing written yet is
 * not listed; one starts from a player's name in a room. Last, every player the player muted, from the server's block
 * list (a muted player's conversation is not listed, and their messages never arrive), each with Unmute.
 */
export function MessagesList() {
  const actions = useRealtimeChatActions();
  const self = useRealtimeChatSelector((state) => state.identity?.playerId);
  const threads = useRealtimeChatSelector((state) => state.dmThreads);
  const online = useRealtimeChatSelector((state) => state.onlinePlayers);
  const unread = useRealtimeChatSelector(
    useShallow((state) => Object.fromEntries(Object.keys(state.dmThreads).map((id) => [id, threadUnread(state, id)]))),
  );
  const names = usePlayerNames();
  const muted = useRealtimeChatSelector((state) => state.blockList?.blocked) ?? [];

  const conversations = useMemo(
    () =>
      Object.values(threads)
        .flatMap(({ thread, messages }) => {
          const last = messages.at(-1);
          const other = thread.participants.find((participant) => participant !== self);
          return last && other ? [{ other, last, unreadCount: unread[thread.id] ?? 0 }] : [];
        })
        .toSorted((a, b) => Date.parse(String(b.last.createdAt)) - Date.parse(String(a.last.createdAt))),
    [threads, self, unread],
  );

  if (conversations.length === 0 && muted.length === 0)
    return (
      <p className="flex flex-1 items-center justify-center text-hud-body text-hud-muted">{CHAT_WORDS.noMessages}</p>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
      {conversations.map(({ other, last, unreadCount }) => {
        const name = resolveChatSenderName(names, other, online[other]?.displayName);
        return (
          <HudRow
            key={other}
            lead={<UserAvatar name={name} address={other} size="lg" className="rounded-full" />}
            label={name}
            title={name}
            detail={<span className="block truncate">{last.content}</span>}
            trail={
              unreadCount > 0 ? (
                <HudChip tone="bad" label={CHAT_WORDS.unread}>
                  {unreadCount}
                </HudChip>
              ) : (
                <span className="text-hud-label text-hud-cue">{whenSent(last.createdAt)}</span>
              )
            }
            onClick={() => actions.openConversation(other)}
          />
        );
      })}
      {muted.length > 0 && (
        <section aria-label={CHAT_WORDS.mutedPlayers} className="mt-2 flex flex-col gap-0.5">
          <h3 className="px-1.5 text-hud-label text-hud-cue">{CHAT_WORDS.mutedPlayers}</h3>
          {muted.map((playerId) => (
            <MutedPlayer
              key={playerId}
              playerId={playerId}
              name={resolveChatSenderName(names, playerId, online[playerId]?.displayName)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/** A muted player in Messages: their portrait and name, and Unmute, which brings their conversation back. */
const MutedPlayer = ({ playerId, name }: { playerId: string; name: string }) => {
  const { toggle } = useMute(playerId);
  return (
    <HudRow
      lead={<UserAvatar name={name} address={playerId} size="lg" className="rounded-full" />}
      title={name}
      trail={
        <HudButton kind="secondary" size="sm" onClick={toggle}>
          {CHAT_WORDS.unmute}
        </HudButton>
      }
    />
  );
};
