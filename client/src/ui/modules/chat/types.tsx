interface ChatMessage {
  address: string;
  identity: bigint;
  channel: bigint;
  name: string;
  content: string;
  fromSelf: boolean;
  timestamp: Date;
}

export interface ChatMetadata {
  messages: ChatMessage[];
  lastMessageReceived: Date;
  isChannel: boolean;
  channel: bigint;
  fromName: string;
  address: string;
}

export interface Tab {
  name: string;
  key: string;
  address: string;
  numberOfMessages?: number;
  displayed: boolean;
  visible: boolean;
  lastSeen: Date;
}
