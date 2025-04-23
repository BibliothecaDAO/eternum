import { filterMessages, sortMessagesByTime } from "@/features/ws-chat/lib/filterUtils";
import { groupMessagesBySender } from "@/features/ws-chat/lib/messageUtils";
import { generateUserCredentials } from "@/features/ws-chat/lib/userCredentials";
import ChatClient from "@/features/ws-chat/model/client";
import { Message, Room, User } from "@/features/ws-chat/model/types";
import {
  useConnectionEvents,
  useDirectMessageEvents,
  useGlobalMessageEvents,
  useInitialDataEvents,
  useRoomEvents,
  useRoomMessageEvents,
  useUserEvents,
} from "@/features/ws-chat/model/useSocketEvents";
import useStore from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DMDrawer } from "./dm-drawer";
import { DMTab } from "./tabs/dm-tab";
import { GlobalChatTab } from "./tabs/global-chat-tab";
import { RoomsTab } from "./tabs/rooms-tab";

type TabType = "global" | "rooms" | "dm";

export function ChatPage() {
  // User state
  const [userId, setUserId] = useState<string>("");
  const [userToken, setUserToken] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isUsernameSet, setIsUsernameSet] = useState<boolean>(false);

  // Chat client
  const chatClientRef = useRef<ChatClient | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>("global");
  const [isDMDrawerOpen, setIsDMDrawerOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [directMessageRecipient, setDirectMessageRecipient] = useState("");
  const [activeRoom, setActiveRoom] = useState("");

  // Users and rooms state
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [offlineUsers, setOfflineUsers] = useState<User[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // Loading states
  // @ts-ignore
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  // @ts-ignore
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Unread messages state
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});

  const { connector } = useStore();

  // Initialize chat client
  const chatClient = useMemo(() => {
    if (!isUsernameSet) return null;

    // If we already have a client instance with the same credentials, reuse it
    if (chatClientRef.current) {
      // Check if credentials match, but safely access socket auth properties
      const socketAuth = chatClientRef.current.socket.auth as {
        token?: string;
        username?: string;
      };

      if (socketAuth.token === userToken && socketAuth.username === username) {
        console.log("Reusing existing chat client");
        return chatClientRef.current;
      }
    }

    // Cleanup any existing socket connection
    if (chatClientRef.current) {
      console.log("Disconnecting previous chat client");
      chatClientRef.current.socket.disconnect();
    }

    console.log("Initializing new chat client for", username);
    const newClient = new ChatClient(userToken, username);
    chatClientRef.current = newClient;
    return newClient;
  }, [userToken, username, isUsernameSet]);

  // Add a message to the state
  const addMessage = useCallback((message: Message) => {
    console.log("Adding message:", message);
    // Force a new array reference to ensure React detects the change
    setMessages((prevMessages) => {
      console.log("Previous message count:", prevMessages.length);

      // Check for duplicates based on content, sender, type and timestamp proximity
      const prev5Messages = prevMessages.slice(-5);
      const isDuplicate = prev5Messages.some((existing) => {
        const sameMessage = existing.message === message.message;
        const sameSender = existing.senderId === message.senderId;
        const sameType = existing.type === message.type;
        const sameRecipient = message.type === "direct" ? existing.recipientId === message.recipientId : true;
        const sameRoom = message.type === "room" ? existing.roomId === message.roomId : true;
        const timeClose =
          Math.abs(new Date(existing.timestamp).getTime() - new Date(message.timestamp).getTime()) < 3000;

        return sameMessage && sameSender && sameType && sameRecipient && sameRoom && timeClose;
      });

      if (isDuplicate) {
        console.log("Duplicate message detected, not adding:", message);
        return prevMessages; // Return unchanged array
      }

      const newMessages = [...prevMessages, message];
      console.log("New message count:", newMessages.length);
      return newMessages;
    });
  }, []);

  // Filter messages based on active tab
  const filteredMessages = useMemo(() => {
    return filterMessages(messages, userId, directMessageRecipient, activeRoom);
  }, [messages, userId, directMessageRecipient, activeRoom]);

  // Sort messages based on active tab
  const sortedMessages = useMemo(() => {
    return sortMessagesByTime(filteredMessages);
  }, [filteredMessages]);

  // Group messages by sender
  const messageGroups = useMemo(() => {
    return groupMessagesBySender(sortedMessages);
  }, [sortedMessages]);

  // Set direct message recipient
  const selectRecipient = useCallback(
    (recipientId: string) => {
      console.log(`Selecting recipient: ${recipientId}`);

      // Show loading state immediately
      setIsLoadingMessages(true);

      // Set recipient immediately
      setDirectMessageRecipient(recipientId);

      // Switch to DM tab
      if (recipientId) {
        setActiveTab("dm");
      }

      // Clear unread messages for this user
      setUnreadMessages((prev) => ({
        ...prev,
        [recipientId]: 0,
      }));

      // Request message history with this user
      if (chatClient && recipientId) {
        console.log(`Requesting direct message history with ${recipientId}`);
        chatClient.getDirectMessageHistory(recipientId);

        // Set a safety timeout to clear loading state if no response
        const safetyTimeout = setTimeout(() => {
          setIsLoadingMessages(false);
        }, 5000);

        return () => clearTimeout(safetyTimeout);
      } else {
        // No chat client or no recipient, clear loading state
        setIsLoadingMessages(false);
      }
    },
    [chatClient, setActiveTab],
  );

  // Join a room
  const joinRoom = useCallback(
    (roomId: string) => {
      if (!chatClient) return;

      console.log(`Joining room: ${roomId}`);

      // Show loading state immediately
      setIsLoadingMessages(true);

      // Clear direct message recipient
      setDirectMessageRecipient("");

      // First set active room to update UI
      setActiveRoom(roomId);

      // Switch to rooms tab
      if (roomId) {
        setActiveTab("rooms");
      }

      // Then join the socket.io room
      if (roomId) {
        chatClient.joinRoom(roomId);

        // Request room history after joining
        setTimeout(() => {
          console.log(`Requesting room history for ${roomId} after join`);
          chatClient.getRoomHistory(roomId);
        }, 100);
      } else {
        setIsLoadingMessages(false);
      }
    },
    [chatClient, setActiveTab],
  );

  // Send a message based on active tab
  const handleSendMessage = useCallback(
    (message: string) => {
      if (!chatClient) return;

      if (directMessageRecipient) {
        chatClient.sendDirectMessage(directMessageRecipient, message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          recipientId: directMessageRecipient,
          message: message,
          timestamp: new Date(),
          type: "direct",
        });
      } else if (activeRoom) {
        chatClient.sendRoomMessage(activeRoom, message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          message: message,
          timestamp: new Date(),
          type: "room",
          roomId: activeRoom,
        });
      } else {
        chatClient.sendGlobalMessage(message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          message: message,
          timestamp: new Date(),
          type: "global",
        });
      }
    },
    [chatClient, directMessageRecipient, activeRoom, userId, username, addMessage],
  );

  // Initialize username from connector
  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => {
        if (name) {
          // Generate deterministic userID and token from username
          const { userId: generatedUserId, token: generatedToken } = generateUserCredentials(name);

          // Set the user credentials
          setUserId(generatedUserId);
          setUserToken(generatedToken);
          setUsername(name);
          setIsUsernameSet(true);
        }
      });
    } catch (error) {
      console.error("Error getting username:", error);
    }
  }, [connector]);

  // Setup chat event handlers
  useInitialDataEvents(
    chatClient,
    setAvailableRooms,
    setOnlineUsers,
    setOfflineUsers,
    setMessages,
    setIsLoadingRooms,
    setIsLoadingUsers,
    setIsLoadingMessages,
  );

  useDirectMessageEvents(
    chatClient,
    userId,
    directMessageRecipient,
    addMessage,
    setUnreadMessages,
    setIsLoadingMessages,
    setMessages,
  );

  useRoomMessageEvents(chatClient, addMessage, setIsLoadingMessages, setMessages);

  useGlobalMessageEvents(chatClient, addMessage, setMessages);

  useUserEvents(chatClient, setOnlineUsers, setOfflineUsers, setIsLoadingUsers, onlineUsers);

  useRoomEvents(chatClient, setAvailableRooms, setIsLoadingRooms);

  useConnectionEvents(chatClient);

  // Request initial data once
  useEffect(() => {
    const initTimer = setTimeout(() => {
      if (chatClient?.socket.connected) {
        console.log("Requesting initial data");
        // No need to request data separately - server will send everything on connection
      }
    }, 500);

    // Set up an interval to periodically request online users and rooms
    const updateInterval = setInterval(() => {
      if (chatClient?.socket.connected) {
        console.log("Refreshing user and room data");
        chatClient.getAllUsers();
        chatClient.getRooms();
      }
    }, 30000);

    return () => {
      console.log("Cleaning up chat client");
      // Clear timers first
      clearTimeout(initTimer);
      clearInterval(updateInterval);

      // Disconnect socket to prevent memory leaks
      if (chatClient) {
        chatClient.socket.disconnect();
      }
    };
  }, [chatClient]);

  // Calculate unread counts for badges
  const dmUnreadCount = useMemo(() => {
    return Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);
  }, [unreadMessages]);

  // Switch to global chat
  // @ts-ignore
  const switchToGlobalChat = useCallback(() => {
    setDirectMessageRecipient("");
    setActiveRoom("");
    setActiveTab("global");
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Tabs
        defaultValue="global"
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as TabType);

          // Clear selections when switching tabs
          if (value === "global") {
            setDirectMessageRecipient("");
            setActiveRoom("");
          }
        }}
        className="w-full"
      >
        <div className="p-2 bg-background sticky top-0 z-10">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="rooms" className="relative">
              Rooms
              {availableRooms.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center z-10">
                  {availableRooms.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dm" className="relative">
              DM
              {dmUnreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center z-10">
                  {dmUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1">
          <TabsContent value="global" className="h-full m-0">
            <GlobalChatTab
              onMentionClick={() => setIsDMDrawerOpen(true)}
              messages={filteredMessages}
              messageGroups={messageGroups}
              onSendMessage={handleSendMessage}
              isLoadingMessages={isLoadingMessages}
              userId={userId}
              selectRecipient={selectRecipient}
            />
          </TabsContent>

          <TabsContent value="rooms" className="h-full m-0">
            <RoomsTab
              onMentionClick={() => setIsDMDrawerOpen(true)}
              rooms={availableRooms}
              activeRoom={activeRoom}
              onRoomSelect={joinRoom}
              messages={filteredMessages}
              messageGroups={messageGroups}
              onSendMessage={handleSendMessage}
              isLoadingMessages={isLoadingMessages}
              userId={userId}
              selectRecipient={selectRecipient}
            />
          </TabsContent>

          <TabsContent value="dm" className="h-full m-0">
            <DMTab
              onNewDMClick={() => setIsDMDrawerOpen(true)}
              onlineUsers={onlineUsers}
              offlineUsers={offlineUsers}
              unreadMessages={unreadMessages}
              directMessageRecipient={directMessageRecipient}
              onSelectRecipient={selectRecipient}
              messages={filteredMessages}
              messageGroups={messageGroups}
              onSendMessage={handleSendMessage}
              isLoadingMessages={isLoadingMessages}
              userId={userId}
            />
          </TabsContent>
        </div>
      </Tabs>

      <DMDrawer
        isOpen={isDMDrawerOpen}
        onClose={() => setIsDMDrawerOpen(false)}
        onSelectUser={selectRecipient}
        onlineUsers={onlineUsers}
        offlineUsers={offlineUsers}
      />
    </div>
  );
}
