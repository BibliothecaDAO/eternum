import { Message, MessageGroup } from "../types";

// Group messages by sender
export const groupMessagesBySender = (
  sortedMessages: Message[]
): MessageGroup[] => {
  return sortedMessages.reduce((groups: Array<MessageGroup>, msg) => {
    // Get the last group or create a new one if none exists
    const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;

    // Check if this is a new sender or if there's a significant time gap (5+ minutes)
    const timeDiff = lastGroup
      ? Math.abs(
          new Date(msg.timestamp).getTime() -
            new Date(
              lastGroup.messages[lastGroup.messages.length - 1].timestamp
            ).getTime()
        )
      : Infinity;
    const isNewTimeGroup = timeDiff > 5 * 60 * 1000; // 5 minutes

    // Always create a new group for short messages like "hey"
    const isShortMessage = msg.message.trim().split(/\s+/).length <= 1;

    // If this is a new sender, time gap, or short message, create a new group
    if (
      !lastGroup ||
      lastGroup.senderId !== msg.senderId ||
      isNewTimeGroup ||
      isShortMessage
    ) {
      groups.push({
        senderId: msg.senderId,
        senderUsername: msg.senderUsername,
        messages: [msg],
      });
    } else {
      // Add to existing group if same sender and within time window
      lastGroup.messages.push(msg);
    }

    return groups;
  }, []);
};
