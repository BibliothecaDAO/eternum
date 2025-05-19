import React from "react";
import { MessageGroup } from "../../types";

// MessageGroup component for better performance
const MessageGroupComponent = React.memo(
  ({
    group,
    userId,
    selectRecipient,
  }: {
    group: MessageGroup;
    userId: string;
    selectRecipient: (userId: string) => void;
  }) => {
    return (
      <div className="message-group space-y-0.5">
        {group.messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`text-sm group hover:bg-gold/5 transition-colors duration-200 ${index === 0 ? "mt-2" : ""}`}
          >
            <div className="flex items-start gap-1">
              <span className="text-white/20 text-xs inline-block w-[34px] text-right shrink-0">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className={`font-bold px-1.5 py-0.5 rounded ${
                    msg.senderId === userId
                      ? "text-orange-400 bg-orange-400/10"
                      : "text-orange-300 hover:text-orange-200 hover:bg-orange-300/10 cursor-pointer"
                  } transition-colors duration-200`}
                  onClick={() => msg.senderId !== userId && selectRecipient(msg.senderId)}
                >
                  {msg.senderId === userId ? "You" : group.senderUsername || msg.senderId}
                </span>
                <span className="break-words text-white/90 ml-1">{msg.message}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },
  // Custom comparison function to ensure component updates when needed
  (prevProps, nextProps) => {
    // Re-render if there are new messages in the group
    if (prevProps.group.messages.length !== nextProps.group.messages.length) {
      return false;
    }
    // Re-render if the last message ID is different
    if (
      prevProps.group.messages[prevProps.group.messages.length - 1]?.id !==
      nextProps.group.messages[nextProps.group.messages.length - 1]?.id
    ) {
      return false;
    }
    return true;
  },
);

export default MessageGroupComponent;
