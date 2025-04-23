// Message type definition
export interface Message {
  id: string;
  senderId: string;
  senderUsername?: string;
  message: string;
  timestamp: Date;
  type: "direct" | "room" | "global";
  roomId?: string;
  recipientId?: string;
}

export interface MessageGroup {
  senderId: string;
  senderUsername?: string;
  messages: Message[];
}
