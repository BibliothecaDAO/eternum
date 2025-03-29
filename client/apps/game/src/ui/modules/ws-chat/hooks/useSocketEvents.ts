import { useEffect } from "react";
import { Message, User, Room } from "../types";
import type ChatClient from "../chat";

// Hook for handling direct message events
export const useDirectMessageEvents = (
  chatClient: ChatClient | null,
  userId: string,
  directMessageRecipient: string,
  addMessage: (message: Message) => void,
  setUnreadMessages: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >,
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  useEffect(() => {
    console.log("Setting up directMessage event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleDirectMessage = ({
      senderId,
      senderUsername,
      recipientId,
      message,
      timestamp,
    }: any) => {
      console.log(
        `Received direct message from ${senderId} (${senderUsername}) to ${
          recipientId || userId
        }: ${message}`
      );

      const actualRecipientId = recipientId || userId;

      addMessage({
        id: Date.now().toString(),
        senderId,
        senderUsername,
        recipientId: actualRecipientId,
        message,
        timestamp: timestamp || new Date(),
        type: "direct",
      });

      if (
        senderId !== userId &&
        actualRecipientId === userId &&
        directMessageRecipient !== senderId
      ) {
        setUnreadMessages((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1,
        }));
      }
    };

    const handleDirectMessageHistory = ({
      otherUserId,
      messages: historyMessages,
      requestId,
    }: any) => {
      console.log(
        `Received direct message history with ${otherUserId} (requestId: ${
          requestId || "none"
        }):`,
        historyMessages?.length || 0,
        "messages"
      );

      if (historyMessages && Array.isArray(historyMessages)) {
        const formattedMessages = historyMessages.map((msg: any) => {
          let senderId = msg.sender_id;
          let recipientId = msg.recipient_id;

          if (!recipientId && msg.room_id === null) {
            recipientId = senderId === userId ? otherUserId : userId;
          }

          return {
            id: msg.id || Date.now() + Math.random().toString(),
            senderId,
            senderUsername: msg.username,
            recipientId,
            message: msg.message,
            timestamp: new Date(msg.created_at),
            type: "direct" as const,
          };
        });

        setMessages((prev: Message[]) => {
          const filteredMessages = prev.filter(
            (msg: Message) =>
              !(
                msg.type === "direct" &&
                ((msg.senderId === userId && msg.recipientId === otherUserId) ||
                  (msg.senderId === otherUserId &&
                    (msg.recipientId === userId ||
                      msg.recipientId === undefined)))
              )
          );

          return [...filteredMessages, ...formattedMessages];
        });

        if (directMessageRecipient === otherUserId) {
          setUnreadMessages((prev) => ({
            ...prev,
            [otherUserId]: 0,
          }));
        }
      }

      setIsLoadingMessages(false);
    };

    // First remove any existing listeners to prevent duplicates
    chatClient.socket.off("directMessage", handleDirectMessage);
    chatClient.socket.off("directMessageHistory", handleDirectMessageHistory);

    // Then register new listeners
    chatClient.socket.on("directMessage", handleDirectMessage);
    chatClient.socket.on("directMessageHistory", handleDirectMessageHistory);

    console.log("directMessage event handlers setup complete");

    return () => {
      console.log("Cleaning up directMessage event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("directMessage", handleDirectMessage);
        chatClient.socket.off(
          "directMessageHistory",
          handleDirectMessageHistory
        );
      }
    };
  }, [
    chatClient,
    userId,
    directMessageRecipient,
    addMessage,
    setUnreadMessages,
    setIsLoadingMessages,
    setMessages,
  ]);
};

// Hook for handling room message events
export const useRoomMessageEvents = (
  chatClient: ChatClient | null,
  addMessage: (message: Message) => void,
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  useEffect(() => {
    console.log("Setting up roomMessage event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleRoomMessage = ({
      senderId,
      senderUsername,
      roomId,
      message,
      timestamp,
    }: any) => {
      console.log(
        `Received room message from ${senderId} (${senderUsername}) in room ${roomId}: ${message}`
      );

      addMessage({
        id: Date.now().toString(),
        senderId,
        senderUsername,
        message,
        timestamp: timestamp || new Date(),
        type: "room",
        roomId,
      });
    };

    const handleRoomHistory = ({ roomId, messages: historyMessages }: any) => {
      console.log(`Received room history for ${roomId}:`, historyMessages);

      if (historyMessages && Array.isArray(historyMessages)) {
        const formattedMessages = historyMessages.map((msg: any) => ({
          id: msg.id || Date.now() + Math.random().toString(),
          senderId: msg.sender_id,
          senderUsername: msg.username,
          message: msg.message,
          timestamp: new Date(msg.created_at),
          type: "room" as const,
          roomId: msg.room_id,
        }));

        setMessages((prev: Message[]) => {
          const filteredMessages = prev.filter(
            (msg: Message) => !(msg.type === "room" && msg.roomId === roomId)
          );

          return [...filteredMessages, ...formattedMessages];
        });
      }

      setIsLoadingMessages(false);
    };

    // Remove any existing listeners to prevent duplicates
    chatClient.socket.off("roomMessage", handleRoomMessage);
    chatClient.socket.off("roomHistory", handleRoomHistory);

    // Register new listeners
    chatClient.socket.on("roomMessage", handleRoomMessage);
    chatClient.socket.on("roomHistory", handleRoomHistory);

    console.log("roomMessage event handlers setup complete");

    return () => {
      console.log("Cleaning up roomMessage event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("roomMessage", handleRoomMessage);
        chatClient.socket.off("roomHistory", handleRoomHistory);
      }
    };
  }, [chatClient, addMessage, setIsLoadingMessages, setMessages]);
};

// Hook for handling global message events
export const useGlobalMessageEvents = (
  chatClient: ChatClient | null,
  addMessage: (message: Message) => void,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
  useEffect(() => {
    console.log("Setting up globalMessage event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleGlobalMessage = ({
      senderId,
      senderUsername,
      message,
      timestamp,
    }: any) => {
      addMessage({
        id: Date.now().toString(),
        senderId,
        senderUsername,
        message,
        timestamp: timestamp || new Date(),
        type: "room",
        roomId: "global",
      });
    };

    const handleGlobalHistory = (history: any[]) => {
      const historyMessages = history.map((msg: any) => ({
        id: Date.now() + Math.random().toString(),
        senderId: msg.sender_id,
        senderUsername: msg.username,
        message: msg.message,
        timestamp: new Date(msg.created_at),
        type: "global" as const,
      }));
      setMessages((prev: Message[]) => [...prev, ...historyMessages]);
    };

    // Remove any existing listeners to prevent duplicates
    chatClient.socket.off("globalMessage", handleGlobalMessage);
    chatClient.socket.off("globalHistory", handleGlobalHistory);

    // Register new listeners
    chatClient.socket.on("globalMessage", handleGlobalMessage);
    chatClient.socket.on("globalHistory", handleGlobalHistory);

    console.log("globalMessage event handlers setup complete");

    return () => {
      console.log("Cleaning up globalMessage event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("globalMessage", handleGlobalMessage);
        chatClient.socket.off("globalHistory", handleGlobalHistory);
      }
    };
  }, [chatClient, addMessage, setMessages]);
};

// Hook for handling user-related events
export const useUserEvents = (
  chatClient: ChatClient | null,
  setOnlineUsers: React.Dispatch<React.SetStateAction<User[]>>,
  setOfflineUsers: React.Dispatch<React.SetStateAction<User[]>>,
  setIsLoadingUsers: React.Dispatch<React.SetStateAction<boolean>>,
  onlineUsers: User[]
) => {
  useEffect(() => {
    console.log("Setting up user event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleOnlineUsers = (users: User[]) => {
      console.log("Received online users:", users.length);
      if (users.length === onlineUsers.length && onlineUsers.length > 0) {
        console.log("Skipping online users update (no change)");
        return;
      }
      setOnlineUsers(users);
    };

    const handleUserJoined = ({ user }: { user: User }) => {
      console.log(`User ${user.id} (${user.username}) joined`);

      setOnlineUsers((prevUsers) => {
        if (prevUsers.some((u) => u.id === user.id)) {
          return prevUsers;
        }
        return [...prevUsers, user];
      });

      setOfflineUsers((prevUsers) => prevUsers.filter((u) => u.id !== user.id));
    };

    const handleUserOffline = ({ userId }: { userId: string }) => {
      console.log(`User ${userId} went offline`);

      const offlineUser = onlineUsers.find((u) => u.id === userId);

      setOnlineUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));

      if (offlineUser) {
        setOfflineUsers((prevUsers) => {
          if (prevUsers.some((u) => u.id === userId)) {
            return prevUsers;
          }
          return [...prevUsers, offlineUser];
        });
      }
    };

    const handleUserLists = ({
      onlineUsers,
      offlineUsers,
    }: {
      onlineUsers: User[];
      offlineUsers: User[];
    }) => {
      console.log(
        `Received user lists: ${onlineUsers.length} online, ${offlineUsers.length} offline`
      );
      setOnlineUsers(onlineUsers);
      setOfflineUsers(offlineUsers);
      setIsLoadingUsers(false);
    };

    // Remove any existing listeners to prevent duplicates
    chatClient.socket.off("onlineUsers", handleOnlineUsers);
    chatClient.socket.off("userJoined", handleUserJoined);
    chatClient.socket.off("userOffline", handleUserOffline);
    chatClient.socket.off("userLists", handleUserLists);

    // Register new listeners
    chatClient.socket.on("onlineUsers", handleOnlineUsers);
    chatClient.socket.on("userJoined", handleUserJoined);
    chatClient.socket.on("userOffline", handleUserOffline);
    chatClient.socket.on("userLists", handleUserLists);

    console.log("User event handlers setup complete");

    return () => {
      console.log("Cleaning up user event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("onlineUsers", handleOnlineUsers);
        chatClient.socket.off("userJoined", handleUserJoined);
        chatClient.socket.off("userOffline", handleUserOffline);
        chatClient.socket.off("userLists", handleUserLists);
      }
    };
  }, [
    chatClient,
    setOnlineUsers,
    setOfflineUsers,
    setIsLoadingUsers,
    onlineUsers,
  ]);
};

// Hook for handling room-related events
export const useRoomEvents = (
  chatClient: ChatClient | null,
  setAvailableRooms: React.Dispatch<React.SetStateAction<Room[]>>,
  setIsLoadingRooms: React.Dispatch<React.SetStateAction<boolean>>
) => {
  useEffect(() => {
    console.log("Setting up room event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleAvailableRooms = (rooms: Room[]) => {
      setAvailableRooms(rooms);
      setIsLoadingRooms(false);
    };

    // Remove any existing listeners to prevent duplicates
    chatClient.socket.off("availableRooms", handleAvailableRooms);

    // Register new listeners
    chatClient.socket.on("availableRooms", handleAvailableRooms);

    console.log("Room event handlers setup complete");

    return () => {
      console.log("Cleaning up room event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("availableRooms", handleAvailableRooms);
      }
    };
  }, [chatClient, setAvailableRooms, setIsLoadingRooms]);
};

// Hook for handling connection events
export const useConnectionEvents = (chatClient: ChatClient | null) => {
  useEffect(() => {
    console.log("Setting up connection event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleConnect = () => {
      console.log("Socket connected with ID:", chatClient?.socket.id);
    };

    const handleDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
    };

    const handleConnectError = (error: Error) => {
      console.error("Connection error:", error);
    };

    // Remove any existing listeners to prevent duplicates
    chatClient.socket.off("connect", handleConnect);
    chatClient.socket.off("disconnect", handleDisconnect);
    chatClient.socket.off("connect_error", handleConnectError);

    // Register new listeners
    chatClient.socket.on("connect", handleConnect);
    chatClient.socket.on("disconnect", handleDisconnect);
    chatClient.socket.on("connect_error", handleConnectError);

    console.log("Connection event handlers setup complete");

    return () => {
      console.log("Cleaning up connection event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("connect", handleConnect);
        chatClient.socket.off("disconnect", handleDisconnect);
        chatClient.socket.off("connect_error", handleConnectError);
      }
    };
  }, [chatClient]);
};

// Hook for handling initial data
export const useInitialDataEvents = (
  chatClient: ChatClient | null,
  setAvailableRooms: React.Dispatch<React.SetStateAction<Room[]>>,
  setOnlineUsers: React.Dispatch<React.SetStateAction<User[]>>,
  setOfflineUsers: React.Dispatch<React.SetStateAction<User[]>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setIsLoadingRooms: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoadingUsers: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>
) => {
  useEffect(() => {
    console.log("Setting up initialData event handlers");
    if (!chatClient || !chatClient.socket) {
      console.warn("ChatClient or socket is null, skipping event setup");
      return;
    }

    const handleInitialData = ({
      globalHistory,
      availableRooms,
      onlineUsers,
      offlineUsers,
    }: {
      globalHistory: any[];
      availableRooms: Room[];
      onlineUsers: User[];
      offlineUsers: User[];
    }) => {
      console.log("Received initial data bundle");

      // Update rooms
      if (availableRooms && Array.isArray(availableRooms)) {
        console.log(`Received ${availableRooms.length} available rooms`);
        setAvailableRooms(availableRooms);
        setIsLoadingRooms(false);
      }

      // Update users
      if (onlineUsers && Array.isArray(onlineUsers)) {
        console.log(`Received ${onlineUsers.length} online users`);
        setOnlineUsers(onlineUsers);
      }

      if (offlineUsers && Array.isArray(offlineUsers)) {
        console.log(`Received ${offlineUsers.length} offline users`);
        setOfflineUsers(offlineUsers);
        setIsLoadingUsers(false);
      }

      // Update global messages
      if (globalHistory && Array.isArray(globalHistory)) {
        console.log(`Received ${globalHistory.length} global messages`);
        const formattedMessages = globalHistory.map((msg: any) => ({
          id: msg.id || Date.now() + Math.random().toString(),
          senderId: msg.sender_id,
          senderUsername: msg.username,
          message: msg.message,
          timestamp: new Date(msg.created_at),
          type: "global" as const,
        }));

        setMessages(formattedMessages);
        setIsLoadingMessages(false);
      }
    };

    // Remove any existing listeners to prevent duplicates
    chatClient.socket.off("initialData", handleInitialData);

    // Register new listeners
    chatClient.socket.on("initialData", handleInitialData);

    console.log("initialData event handlers setup complete");

    return () => {
      console.log("Cleaning up initialData event handlers");
      if (chatClient && chatClient.socket) {
        chatClient.socket.off("initialData", handleInitialData);
      }
    };
  }, [
    chatClient,
    setAvailableRooms,
    setOnlineUsers,
    setOfflineUsers,
    setMessages,
    setIsLoadingRooms,
    setIsLoadingUsers,
    setIsLoadingMessages,
  ]);
};
