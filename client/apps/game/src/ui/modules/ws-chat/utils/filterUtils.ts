import { Message, Room, User } from "../types";

// Filter messages based on user ID, recipient, and room
export const filterMessages = (
  messages: Message[],
  userId: string,
  directMessageRecipient: string,
  activeRoom: string
): Message[] => {
  return messages.filter((msg) => {
    // If we have a direct message recipient, show direct messages
    if (directMessageRecipient) {
      return (
        msg.type === "direct" &&
        ((msg.senderId === userId &&
          msg.recipientId === directMessageRecipient) ||
          (msg.senderId === directMessageRecipient &&
            (msg.recipientId === userId || msg.recipientId === undefined)))
      );
    }
    // If we have an active room, show room messages
    if (activeRoom) {
      return msg.type === "room" && msg.roomId === activeRoom;
    }
    // Otherwise show global messages
    return msg.type === "global";
  });
};

// Sort messages by timestamp
export const sortMessagesByTime = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
};

// Filter rooms based on search input
export const filterRoomsBySearch = (
  rooms: Room[],
  searchText: string
): Room[] => {
  if (!searchText.trim()) return rooms;

  return rooms.filter((room) =>
    (room.name || room.id).toLowerCase().includes(searchText.toLowerCase())
  );
};

// Filter users based on search input
export const filterUsersBySearch = (
  users: User[],
  searchText: string
): User[] => {
  if (!searchText.trim()) return users;

  return users.filter((user) =>
    (user.username || user.id).toLowerCase().includes(searchText.toLowerCase())
  );
};
