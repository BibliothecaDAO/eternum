export interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
  guild?: string;
}

export interface User {
  id: number;
  name: string;
  guild: string;
  avatar: string;
  online: boolean;
  unreadCount: number;
}
