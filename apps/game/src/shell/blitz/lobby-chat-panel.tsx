import { type FormEvent, useEffect, useRef, useState } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { YOU } from "@/ui/design-system/kit/words";
import type { WorldChatMessage } from "@bibliothecadao/types";
import { displayPlayerName } from "@bibliothecadao/eternum";

import { isSameStarknetAddress } from "@realms-world/identity";
import { Kbd } from "../frame/kbd";
import { Panel } from "../panel";
import { ServiceFailure } from "../service-failure";
import { CHAT_WORDS } from "../words";
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
 * Enter or the keyboard's Send sending. A reader sees no field.
 */
export const LobbyChatPanel = ({ slotName, membership }: { slotName: string; membership: string }) => {
  const chat = useLobbyChat(slotName, membership);
  return (
    <Panel icon="Ct" title={CHAT_WORDS.chat}>
      {chat.hold === "signed-out" ? (
        <p className="px-1 py-2 text-[15px] text-kit-muted">{CHAT_WORDS.signInToRead}</p>
      ) : chat.hold === "unanswered" ? (
        <ServiceFailure service="chat" error={new Error("lobby chat closed")} />
      ) : (
        <>
          <Messages messages={chat.messages} />
          {chat.hold && HOLD_LINES[chat.hold] && (
            <p className="px-1 text-[13px] text-kit-amber">{HOLD_LINES[chat.hold]}</p>
          )}
          {chat.canWrite && <Composer send={chat.send} />}
        </>
      )}
    </Panel>
  );
};

/** The messages, kept scrolled to the newest as they arrive. */
const Messages = ({ messages }: { messages: readonly WorldChatMessage[] }) => {
  const { session } = useIdentitySession();
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);
  return (
    <ol ref={list} className="flex h-64 flex-col gap-1.5 overflow-y-auto px-1 py-2 text-[15px]">
      {messages.map((message) => (
        <li key={message.id} className="break-words">
          <b className="mr-2 font-ui text-kit-gold2">
            {isOwn(message, session?.user.realmsId)
              ? YOU
              : displayPlayerName(message.sender.playerId, message.sender.displayName ?? null)}
          </b>
          <span className="text-kit-cream">{message.content}</span>
        </li>
      ))}
    </ol>
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
    <form onSubmit={submit} className="relative">
      <input
        aria-label={CHAT_WORDS.message}
        placeholder={CHAT_WORDS.message}
        enterKeyHint="send"
        maxLength={MESSAGE_LIMIT}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="h-12 w-full rounded-xl border-2 border-kit-line2 bg-kit-ground px-3 pr-16 text-[15px] text-kit-cream placeholder:text-kit-muted focus:border-kit-peach focus:outline-none"
      />
      <Kbd keyName="Enter" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 max-lg:hidden" />
    </form>
  );
};
