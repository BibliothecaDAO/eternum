import {useState, useEffect, useCallback, useRef} from 'react';
import {ChatClient} from '../../../features/chat';
import {
  groupMessagesBySender,
  filterMessages,
  sortMessagesByTime,
  filterRoomsBySearch,
  filterUsersBySearch,
  generateUserCredentials,
} from '../../../features/chat';
import type {Message, MessageGroup, Room, User} from '../../../features/chat';

export function useChat(username: string) {
  const clientRef = useRef<ChatClient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeRoom, setActiveRoom] = useState('');
  const [directMessageRecipient, setDirectMessageRecipient] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>(
    {},
  );

  const {userId, token} = generateUserCredentials(username);

  useEffect(() => {
    const client = new ChatClient(token, username);
    clientRef.current = client;

    client.socket.on('connect', () => {
      setIsConnected(true);
      setIsLoading(false);
      client.getAllUsers();
      client.getRooms();
    });

    client.socket.on('disconnect', () => {
      setIsConnected(false);
    });

    client.socket.on(
      'globalMessage',
      (msg: {
        senderId: string;
        senderUsername?: string;
        message: string;
        timestamp: string;
      }) => {
        setMessages(prev => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            senderId: msg.senderId,
            senderUsername: msg.senderUsername,
            message: msg.message,
            timestamp: new Date(msg.timestamp),
            type: 'global',
          },
        ]);
      },
    );

    client.socket.on(
      'directMessage',
      (msg: {
        senderId: string;
        senderUsername?: string;
        recipientId?: string;
        message: string;
        timestamp: string;
      }) => {
        setMessages(prev => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            senderId: msg.senderId,
            senderUsername: msg.senderUsername,
            recipientId: msg.recipientId,
            message: msg.message,
            timestamp: new Date(msg.timestamp),
            type: 'direct',
          },
        ]);
        if (msg.senderId !== userId) {
          setUnreadMessages(prev => ({
            ...prev,
            [msg.senderId]: (prev[msg.senderId] || 0) + 1,
          }));
        }
      },
    );

    client.socket.on(
      'roomMessage',
      (msg: {
        senderId: string;
        senderUsername?: string;
        roomId: string;
        message: string;
        timestamp: string;
      }) => {
        setMessages(prev => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            senderId: msg.senderId,
            senderUsername: msg.senderUsername,
            roomId: msg.roomId,
            message: msg.message,
            timestamp: new Date(msg.timestamp),
            type: 'room',
          },
        ]);
      },
    );

    client.socket.on('onlineUsers', (users: User[]) => {
      setOnlineUsers(users);
    });

    client.socket.on('allUsers', (users: User[]) => {
      setAllUsers(users);
    });

    client.socket.on('rooms', (data: Room[]) => {
      setRooms(data);
    });

    client.socket.on('directMessageHistory', (history: Message[]) => {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const newMsgs = history.filter(m => !ids.has(m.id));
        return [...prev, ...newMsgs];
      });
    });

    client.socket.on('roomHistory', (history: Message[]) => {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const newMsgs = history.filter(m => !ids.has(m.id));
        return [...prev, ...newMsgs];
      });
    });

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [token, username, userId]);

  const sendGlobalMessage = useCallback(
    (text: string) => {
      clientRef.current?.sendGlobalMessage(text);
    },
    [],
  );

  const sendDirectMessage = useCallback(
    (text: string) => {
      if (directMessageRecipient) {
        clientRef.current?.sendDirectMessage(directMessageRecipient, text);
      }
    },
    [directMessageRecipient],
  );

  const sendRoomMessage = useCallback(
    (text: string) => {
      if (activeRoom) {
        clientRef.current?.sendRoomMessage(activeRoom, text);
      }
    },
    [activeRoom],
  );

  const joinRoom = useCallback((roomId: string) => {
    clientRef.current?.joinRoom(roomId);
    clientRef.current?.getRoomHistory(roomId);
    setActiveRoom(roomId);
  }, []);

  const leaveRoom = useCallback(() => {
    setActiveRoom('');
  }, []);

  const selectRecipient = useCallback(
    (recipientId: string) => {
      setDirectMessageRecipient(recipientId);
      clientRef.current?.getDirectMessageHistory(recipientId);
      setUnreadMessages(prev => {
        const next = {...prev};
        delete next[recipientId];
        return next;
      });
    },
    [],
  );

  const clearRecipient = useCallback(() => {
    setDirectMessageRecipient('');
  }, []);

  const filteredMessages = filterMessages(
    messages,
    userId,
    directMessageRecipient,
    activeRoom,
  );
  const sortedMessages = sortMessagesByTime(filteredMessages);
  const messageGroups = groupMessagesBySender(sortedMessages);

  const offlineUsers = allUsers.filter(
    u => !onlineUsers.find(o => o.id === u.id),
  );

  return {
    userId,
    isConnected,
    isLoading,
    messages: messageGroups,
    rooms,
    onlineUsers,
    offlineUsers,
    allUsers,
    activeRoom,
    directMessageRecipient,
    unreadMessages,
    sendGlobalMessage,
    sendDirectMessage,
    sendRoomMessage,
    joinRoom,
    leaveRoom,
    selectRecipient,
    clearRecipient,
    filterRoomsBySearch,
    filterUsersBySearch,
  };
}
