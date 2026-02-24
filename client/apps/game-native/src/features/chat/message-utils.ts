import type {Message, MessageGroup, Room, User} from './types';

export const groupMessagesBySender = (
  sortedMessages: Message[],
): MessageGroup[] => {
  return sortedMessages.reduce((groups: MessageGroup[], msg) => {
    const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;
    const timeDiff = lastGroup
      ? Math.abs(
          new Date(msg.timestamp).getTime() -
            new Date(
              lastGroup.messages[lastGroup.messages.length - 1].timestamp,
            ).getTime(),
        )
      : Infinity;
    const isNewTimeGroup = timeDiff > 5 * 60 * 1000;
    const isShortMessage = msg.message.trim().split(/\s+/).length <= 1;

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
      lastGroup.messages.push(msg);
    }
    return groups;
  }, []);
};

export const filterMessages = (
  messages: Message[],
  userId: string,
  directMessageRecipient: string,
  activeRoom: string,
): Message[] => {
  return messages.filter(msg => {
    if (directMessageRecipient) {
      return (
        msg.type === 'direct' &&
        ((msg.senderId === userId &&
          msg.recipientId === directMessageRecipient) ||
          (msg.senderId === directMessageRecipient &&
            (msg.recipientId === userId ||
              msg.recipientId === undefined)))
      );
    }
    if (activeRoom) {
      return msg.type === 'room' && msg.roomId === activeRoom;
    }
    return msg.type === 'global';
  });
};

export const sortMessagesByTime = (messages: Message[]): Message[] => {
  return [...messages].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
};

export const filterRoomsBySearch = (
  rooms: Room[],
  searchText: string,
): Room[] => {
  if (!searchText.trim()) return rooms;
  return rooms.filter(room =>
    (room.name || room.id).toLowerCase().includes(searchText.toLowerCase()),
  );
};

export const filterUsersBySearch = (
  users: User[],
  searchText: string,
): User[] => {
  if (!searchText.trim()) return users;
  return users.filter(user =>
    (user?.username || user?.id)
      .toLowerCase()
      .includes(searchText.toLowerCase()),
  );
};
