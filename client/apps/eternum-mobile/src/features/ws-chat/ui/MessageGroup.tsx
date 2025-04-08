import React from "react";
import { MessageGroup } from "../model/types";

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
      <div className="message-group">
        {group.messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span className="text-white/30 text-xs">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>{" "}
            <span
              className={`font-bold px-2 ${
                msg.senderId === userId
                  ? "text-orange-400"
                  : "text-orange-300 hover:text-orange-200 hover:underline cursor-pointer"
              }`}
              onClick={() => msg.senderId !== userId && selectRecipient(msg.senderId)}
            >
              {msg.senderId === userId ? "You" : group.senderUsername || msg.senderId}
            </span>
            <span className="">{msg.message}</span>
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
