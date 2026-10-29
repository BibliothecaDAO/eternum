import { type FormEvent, useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import type { PlaytestSlot } from "../blitz-slot";
import { YOU, CHAT_WORDS } from "@/ui/design-system/kit/words";
import type { WorldChatMessage } from "@bibliothecadao/types";
import { resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";

import { isSameStarknetAddress } from "@realms-world/identity";
import { AppButton, AppField, AppPanel } from "@/ui/design-system/kit/app-elements";
import { useStickToLatest } from "@/hooks/use-stick-to-latest";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { type ChatHold, useLobbyChat } from "./lobby-chat";

/** The longest message the chat takes (packages/types chat/shared.ts). */
const MESSAGE_LIMIT = 2000;

const HOLD_LINES: Partial<Record<ChatHold, string>> = {
  "rate-limited": CHAT_WORDS.rateLimited,
  refused: CHAT_WORDS.refused,
};

/**
 * The lobby's chat, under the countdown on a desktop and under the registered count on a phone: its messages, oldest at
 * the top, read by any signed-in player, and the field for one the room lets write (a player registered in the slot),
 * Enter or the keyboard's Send sending. A reader sees no field, and the line that says who writes; an empty room
 * says so.
 */
export const LobbyChatPanel = ({
  slot,
  membership,
}: {
  slot: Pick<PlaytestSlot, "chainId" | "name">;
  membership: string;
}) => {
  const chat = useLobbyChat(slot, membership);
  return (
    <AppPanel icon="chat" title={CHAT_WORDS.chat}>
      {chat.hold === "signed-out" ? (
        <p className="py-2 text-app-body text-app-muted">{CHAT_WORDS.signInToRead}</p>
      ) : chat.hold === "unanswered" ? (
        <ServiceFailure service="chat" error={new Error("lobby chat closed")} />
      ) : (
        <>
          {chat.messages.length > 0 ? (
            <Messages messages={chat.messages} />
          ) : (
            <p className="py-2 text-app-body text-app-muted">{CHAT_WORDS.empty}</p>
          )}
          {chat.hold && HOLD_LINES[chat.hold] && (
            <p className="text-app-label text-app-warn">{HOLD_LINES[chat.hold]}</p>
          )}
          {chat.canWrite ? (
            <Composer send={chat.send} />
          ) : (
            <p className="text-app-label text-app-muted">{CHAT_WORDS.registeredWrite}</p>
          )}
        </>
      )}
    </AppPanel>
  );
};

/** The messages, opened on the newest and kept there as they arrive, unless the reader scrolled up to read. */
const Messages = ({ messages }: { messages: readonly WorldChatMessage[] }) => {
  const { session } = useIdentitySession();
  // A sender's name is read as the list draws, and the list draws again when one lands.
  const names = usePlayerNames();
  const { scrollerRef, hasNewer, jumpToLatest } = useStickToLatest({
    oldest: messages[0]?.id,
    newest: messages.at(-1)?.id,
  });
  return (
    <div className="relative">
      <ol ref={scrollerRef} className="flex max-h-64 flex-col gap-1.5 overflow-y-auto py-2 text-app-body text-app-ink">
        {messages.map((message) => (
          <li key={message.id} className="break-words">
            <b className="mr-2 text-app-accent">
              {isOwn(message, session?.user.realmsId)
                ? YOU
                : resolveChatSenderName(names, message.sender.playerId, message.sender.displayName)}
            </b>
            <span>{message.content}</span>
          </li>
        ))}
      </ol>
      {hasNewer && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <div className="pointer-events-auto">
            <AppButton kind="secondary" icon="arrow-down" onClick={jumpToLatest}>
              {CHAT_WORDS.newMessages}
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
};

const isOwn = (message: WorldChatMessage, realmsId: string | undefined) =>
  realmsId !== undefined && isSameStarknetAddress(message.sender.playerId, realmsId);

/** The field of a player the room lets write: Enter sends the message. */
const Composer = ({ send }: { send: (content: string) => void }) => {
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    send(content);
    setDraft("");
  };
  return (
    <form onSubmit={submit}>
      <AppField
        label={CHAT_WORDS.message}
        icon="chat"
        placeholder={CHAT_WORDS.message}
        enterKeyHint="send"
        maxLength={MESSAGE_LIMIT}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </form>
  );
};
