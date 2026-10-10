import { useEffect, useRef } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { YOU } from "@/ui/design-system/kit/words";
import type { WorldChatMessage } from "@bibliothecadao/types";
import { displayPlayerName } from "@bibliothecadao/eternum";

import { isSameStarknetAddress } from "@realms-world/identity";
import { Panel } from "../panel";
import { ServiceFailure } from "../service-failure";
import { CHAT_WORDS } from "../words";
import { useLobbyChat } from "./lobby-chat";

/**
 * The lobby's chat (desktop): its messages, oldest at the top, read by any signed-in player. It has no field: who may
 * write in a slot's lobby is not ruled yet.
 */
export const LobbyChatPanel = ({ slotName }: { slotName: string }) => {
  const chat = useLobbyChat(slotName);
  return (
    <Panel icon="Ct" title={CHAT_WORDS.chat}>
      {chat.hold === "signed-out" ? (
        <p className="px-1 py-2 text-[15px] text-kit-muted">{CHAT_WORDS.signInToRead}</p>
      ) : chat.hold === "unanswered" ? (
        <ServiceFailure service="chat" error={new Error("lobby chat closed")} />
      ) : (
        <Messages messages={chat.messages} />
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
