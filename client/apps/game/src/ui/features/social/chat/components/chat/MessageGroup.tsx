import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import React from "react";
import { MessageGroup } from "../../types";

type MessagePart = {
  type: "text" | "coordinates";
  content: string | { x: number; y: number };
};

// Helper function to detect coordinates in message and split message into parts
const processMessage = (message: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  let lastIndex = 0;

  // Find all coordinate matches (with optional space after comma)
  const regex = /(-?\d+),\s*(-?\d+)/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    // Add text before coordinates
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: message.slice(lastIndex, match.index),
      });
    }

    // Add coordinates
    parts.push({
      type: "coordinates",
      content: {
        x: parseInt(match[1]),
        y: parseInt(match[2]),
      },
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < message.length) {
    parts.push({
      type: "text",
      content: message.slice(lastIndex),
    });
  }

  return parts;
};

// Coordinate navigation button component
const CoordinateNavButton = ({ coordinates }: { coordinates: { x: number; y: number } }) => {
  const navigateToMapView = useNavigateToMapView();
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <button
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-gold hover:text-gold/50 transition-colors duration-200 rounded bg-gold/15 hover:bg-gold/25"
      onClick={() => navigateToMapView(new Position(coordinates))}
      onMouseEnter={() => {
        setTooltip({
          content: "View on Map",
          position: "top",
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    >
      <span className="text-xs">{`${coordinates.x}, ${coordinates.y}`}</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path d="M8.25 10.875a2.625 2.625 0 115.25 0 2.625 2.625 0 01-5.25 0z" />
        <path
          fillRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.125 4.5a4.125 4.125 0 102.338 7.524l2.007 2.006a.75.75 0 101.06-1.06l-2.006-2.007a4.125 4.125 0 00-3.399-6.463z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
};

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
        {group.messages.map((msg, index) => {
          const messageParts = processMessage(msg.message);
          return (
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
                  <span className="break-words text-white/90 ml-1">
                    {messageParts.map((part, i) => (
                      <React.Fragment key={i}>
                        {part.type === "text" ? (
                          <>{part.content}</>
                        ) : (
                          <CoordinateNavButton coordinates={part.content as { x: number; y: number }} />
                        )}
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
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
