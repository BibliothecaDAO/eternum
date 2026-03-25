import { Bot, Send, User } from "lucide-react";
import type { AgentMessage } from "@bibliothecadao/types";

import { formatTimestamp } from "../agent-dock-utils";

export const ChatTab = ({
  messages,
  draftMessage,
  onDraftChange,
  onSend,
  isSending,
}: {
  messages: AgentMessage[];
  draftMessage: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
}) => {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((message) => {
          if (message.senderType === "system") {
            return (
              <div key={message.id} className="px-2 py-1 text-center text-xs italic text-gold/45">
                {message.content}
              </div>
            );
          }

          const isAgent = message.senderType === "agent";

          return (
            <div
              key={message.id}
              className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  isAgent
                    ? "border border-gold/10 bg-gold/5"
                    : "border border-gold/25 bg-black/35"
                }`}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-gold/50">
                  {isAgent ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  <span>{isAgent ? "Agent" : "You"}</span>
                  <span className="text-gold/35">{formatTimestamp(message.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm text-gold/85">{message.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2 rounded-2xl border border-gold/10 bg-black/35 p-3">
        <textarea
          value={draftMessage}
          onChange={(event) => onDraftChange(event.target.value)}
          rows={2}
          placeholder="Guide your agent..."
          className="flex-1 resize-none bg-transparent text-sm text-gold outline-none placeholder:text-gold/35"
        />
        <button
          type="button"
          disabled={!draftMessage.trim() || isSending}
          onClick={onSend}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-black disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
