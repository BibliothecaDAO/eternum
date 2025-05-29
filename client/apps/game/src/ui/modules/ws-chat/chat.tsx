import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import "./App.css";
import ChatClient from "./client/client";
import LoginForm from "./components/chat/LoginForm";
import MessageGroupComponent from "./components/chat/MessageGroup";
import MessageInput from "./components/chat/MessageInput";
import UserItem from "./components/chat/UserItem";

import { useAccountStore } from "@/hooks/store/use-account-store";
import CircleButton from "@/ui/elements/circle-button";
import {
  chatLogger,
  useConnectionEvents,
  useDirectMessageEvents,
  useGlobalMessageEvents,
  useInitialDataEvents,
  useRoomEvents,
  useRoomMessageEvents,
  useUserEvents,
} from "./hooks/useSocketEvents";
import { Message, Room } from "./types";
import { useChatStore } from "./useChatStore";
import { filterMessages, filterRoomsBySearch, filterUsersBySearch, sortMessagesByTime } from "./utils/filterUtils";
import { groupMessagesBySender } from "./utils/messageUtils";
import { generateUserCredentials, initialToken, initialUserId } from "./utils/userCredentials";

function ChatModule() {
  // User state
  const [userId, setUserId] = useState<string>(initialUserId);
  const [userToken, setUserToken] = useState<string>(initialToken);
  const [username, setUsername] = useState<string>("");
  const [isUsernameSet, setIsUsernameSet] = useState<boolean>(false);
  const [isRoomsVisible, setIsRoomsVisible] = useState<boolean>(false);
  const [isUsersVisible, setIsUsersVisible] = useState<boolean>(false);

  // Room creation state
  const [showRoomCreation, setShowRoomCreation] = useState<boolean>(false);

  // Chat client state
  const chatClientRef = useRef<ChatClient | null>(null);

  // Account store state
  const { connector } = useAccountStore((state) => state);

  const isExpanded = useChatStore((state) => state.isExpanded);
  const isMinimized = useChatStore((state) => state.isMinimized);
  const activeTabId = useChatStore((state) => state.activeTabId);
  const tabs = useChatStore((state) => state.tabs);
  const isStoreLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  const chatActions = useChatStore((state) => state.actions);

  const { onlineUsers, offlineUsers, isLoadingUsers } = useChatStore((state) => ({
    onlineUsers: state.onlineUsers,
    offlineUsers: state.offlineUsers,
    isLoadingUsers: state.isLoadingUsers,
  }));

  // Chat client instance
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
        chatLogger.log("Reusing existing chat client");
        return chatClientRef.current;
      }
    }

    // Cleanup any existing socket connection
    if (chatClientRef.current) {
      chatLogger.log("Disconnecting previous chat client");
      chatClientRef.current.socket.disconnect();
    }

    chatLogger.log("Initializing new chat client for", username);
    const newClient = new ChatClient(userToken, username);
    chatClientRef.current = newClient;
    return newClient;
  }, [userToken, username, isUsernameSet]);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newRoomId, setNewRoomId] = useState("");

  // Online users state
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // Local loading state to be compatible with hooks expecting React.Dispatch
  const [_isLoadingMessagesLocal, _setIsLoadingMessagesLocal] = useState<boolean>(true);

  // Add loading states
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Unread messages state - track unread messages by user ID
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem("chat_unread_messages");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error reading unread messages from localStorage:", error);
      return {};
    }
  });

  // Update localStorage when unread messages change
  useEffect(() => {
    try {
      localStorage.setItem("chat_unread_messages", JSON.stringify(unreadMessages));
    } catch (error) {
      console.error("Error saving unread messages to localStorage:", error);
    }
  }, [unreadMessages]);

  // Auto-scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Add search state variables
  const [roomSearch, setRoomSearch] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");

  // Add new state for initial scroll
  const [isInitialScrollComplete, setIsInitialScrollComplete] = useState(false);
  const [shouldShowTransition, setShouldShowTransition] = useState(true);

  // Modify scrollToBottom function
  const scrollToBottom = useCallback(() => {
    // First attempt at immediate scroll
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }

    // Secondary attempt with a short delay
    setTimeout(() => {
      // Method 1: Using scrollIntoView with immediate behavior
      messagesEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });

      // Method 2: Direct container manipulation as backup
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 10);

    // Final attempt with a longer delay to catch any edge cases
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      // Set initial scroll complete after final attempt
      setIsInitialScrollComplete(true);
    }, 300);
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    console.log("Messages updated, triggering scroll");
    chatActions.setIsLoadingMessages(false);
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Add effect to handle scroll when chat is reopened
  useEffect(() => {
    if (!isMinimized) {
      setIsInitialScrollComplete(false); // Reset scroll state
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isMinimized, scrollToBottom]);

  // Synchronize local loading state with Zustand store
  useEffect(() => {
    chatActions.setIsLoadingMessages(_isLoadingMessagesLocal);
  }, [_isLoadingMessagesLocal, chatActions]);

  // Synchronize Zustand store changes back to local state if needed
  useEffect(() => {
    _setIsLoadingMessagesLocal(isStoreLoadingMessages);
  }, [isStoreLoadingMessages]);

  // Add a message to the state with optimistic update for better UX
  const addMessage = useCallback(
    (message: Message) => {
      // Force a new array reference to ensure React detects the change
      setMessages((prevMessages) => {
        // Check for duplicates based on content, sender, type and timestamp proximity
        const isDuplicate = prevMessages.some(
          (existing) =>
            existing.message === message.message &&
            existing.senderId === message.senderId &&
            existing.type === message.type &&
            (message.type === "direct" ? existing.recipientId === message.recipientId : true) &&
            (message.type === "room" ? existing.roomId === message.roomId : true) &&
            // Check if timestamps are within 2 seconds of each other
            Math.abs(new Date(existing.timestamp).getTime() - new Date(message.timestamp).getTime()) < 2000,
        );

        if (isDuplicate) {
          chatLogger.log("Duplicate message detected, not adding:", message);
          return prevMessages; // Return unchanged array
        }

        const newMessages = [...prevMessages, message];
        chatLogger.log("New message count:", newMessages.length);
        return newMessages;
      });

      // Force scroll after adding message
      scrollToBottom();
    },
    [scrollToBottom],
  );

  // Get active tab info
  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId);
  }, [tabs, activeTabId]);

  // Filter messages based on active tab
  const filteredMessages = useMemo(() => {
    if (!activeTab) return [];
    return filterMessages(
      messages,
      userId,
      activeTab.type === "direct" ? activeTab.recipientId || "" : "",
      activeTab.type === "room" ? activeTab.roomId || "" : "",
    );
  }, [messages, userId, activeTab]);

  // Sort messages based on active tab
  const sortedMessages = useMemo(() => {
    return sortMessagesByTime(filteredMessages);
  }, [filteredMessages]);

  // Group messages by sender
  const messageGroups = useMemo(() => {
    return groupMessagesBySender(sortedMessages);
  }, [sortedMessages]);

  useEffect(() => {
    if (chatClient && activeTab && activeTab.type === "direct") {
      chatLogger.log(`Requesting direct message history with ${activeTab.recipientId}`);

      // Use requestAnimationFrame to ensure UI updates before sending socket request
      window.requestAnimationFrame(() => {
        chatClient.getDirectMessageHistory(activeTab.recipientId || "");
      });

      // Set a safety timeout to clear loading state if no response
      const safetyTimeout = setTimeout(() => {
        chatActions.setIsLoadingMessages(false);
      }, 5000);

      return () => clearTimeout(safetyTimeout);
    } else {
      // No chat client, clear loading state
      chatActions.setIsLoadingMessages(false);
    }
  }, [chatClient, activeTab]);

  // Add effect to handle scroll when messages are loaded
  useEffect(() => {
    if (!isStoreLoadingMessages && filteredMessages.length > 0) {
      setIsInitialScrollComplete(false); // Reset scroll state
      scrollToBottom();
    }
  }, [isStoreLoadingMessages, filteredMessages.length, scrollToBottom]);
  // Add effect to open Game Chat by default only once at initial load
  useEffect(() => {
    // Only add Game Chat tab if there are no tabs at all
    if (tabs.length === 0) {
      chatActions.addTab({
        type: "global",
        name: "Game Chat",
      });
    }
  }, []); // Empty dependency array means this runs only once at mount

  // Modify the Global Chat button click handler
  const handleGlobalChatClick = useCallback(() => {
    const existingGlobalTab = tabs.find((tab) => tab.type === "global");
    if (existingGlobalTab) {
      chatActions.setActiveTab(existingGlobalTab.id);
    } else {
      chatActions.addTab({
        type: "global",
        name: "Game Chat",
      });
    }
    setIsRoomsVisible(false);
  }, [chatActions, tabs]);

  // Add effect to disable transition after initial load
  useEffect(() => {
    if (isInitialScrollComplete) {
      setShouldShowTransition(false);
    }
  }, [isInitialScrollComplete]);

  // Update message sending logic
  const handleSendMessage = useCallback(
    (message: string) => {
      if (!chatClient || !activeTab) return;

      if (activeTab.type === "direct" && activeTab.recipientId) {
        chatClient.sendDirectMessage(activeTab.recipientId, message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          recipientId: activeTab.recipientId,
          message: message,
          timestamp: new Date(),
          type: "direct",
        });
      } else if (activeTab.type === "room" && activeTab.roomId) {
        chatClient.sendRoomMessage(activeTab.roomId, message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          message: message,
          timestamp: new Date(),
          type: "room",
          roomId: activeTab.roomId,
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
    [chatClient, activeTab, userId, username, addMessage],
  );

  // Handle username submission
  const handleLogin = (newUsername: string) => {
    // Generate deterministic userID and token from username
    const { userId: generatedUserId, token: generatedToken } = generateUserCredentials(newUsername);

    // Set the user credentials
    setUserId(generatedUserId);
    setUserToken(generatedToken);
    setUsername(newUsername);
    setIsUsernameSet(true);
  };

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => handleLogin(name));
    } catch (error) {}
  }, [connector]);

  // Setup chat event handlers
  useInitialDataEvents(
    chatClient,
    setAvailableRooms,
    setMessages,
    setIsLoadingRooms,
    _setIsLoadingMessagesLocal, // Pass local setter to hooks
  );

  useDirectMessageEvents(
    chatClient,
    userId,
    activeTab && activeTab.type === "direct" ? activeTab.recipientId || "" : "",
    addMessage,
    setUnreadMessages,
    _setIsLoadingMessagesLocal, // Pass local setter to hooks
    setMessages,
  );

  useRoomMessageEvents(
    chatClient,
    activeTab && activeTab.type === "room" ? activeTab.roomId || "" : "",
    addMessage,
    _setIsLoadingMessagesLocal,
    setMessages,
  );

  useGlobalMessageEvents(chatClient, addMessage, setMessages);

  useUserEvents(chatClient);

  useRoomEvents(chatClient, setAvailableRooms, setIsLoadingRooms);

  useConnectionEvents(chatClient);

  // Request initial data once (after a short delay to ensure connection is ready)
  useEffect(() => {
    const initTimer = setTimeout(() => {
      if (chatClient?.socket.connected) {
        chatLogger.log("Requesting initial data");
        // No need to request data separately - server will send everything on connection
      }
    }, 500);

    // Set up an interval to periodically request online users and rooms
    const updateInterval = setInterval(() => {
      if (chatClient?.socket.connected) {
        chatLogger.log("Refreshing user and room data");
        chatClient.getAllUsers();
        chatClient.getRooms();
      }
    }, 30000);

    return () => {
      chatLogger.log("Cleaning up chat client");
      // Clear timers first
      clearTimeout(initTimer);
      clearInterval(updateInterval);

      // Disconnect socket to prevent memory leaks
      if (chatClient) {
        chatClient.socket.disconnect();
      }
    };
  }, [chatClient]);

  const joinedRoomsRef = useRef(new Set<string>());

  // Automatically join all available rooms to receive notifications
  useEffect(() => {
    if (chatClient && chatClient.socket && chatClient.socket.connected && availableRooms.length > 0) {
      availableRooms.forEach((room) => {
        if (!joinedRoomsRef.current.has(room.id)) {
          chatLogger.log(`Auto-joining room for notifications: ${room.id}`);
          chatClient.joinRoom(room.id);
          joinedRoomsRef.current.add(room.id);
        }
      });
    }
    // If the socket disconnects, we might want to clear joinedRoomsRef
    // so it attempts to rejoin when connection is re-established.
    // However, the current ChatClient re-initialization on disconnect/reconnect might handle this implicitly
    // by creating a new client instance, which would also mean a new joinedRoomsRef effectively.
    // For now, let's keep the dependencies simple.
  }, [chatClient, availableRooms, chatClient?.socket?.connected]);

  // Filter rooms based on search input
  const filteredRooms = useMemo(() => {
    return filterRoomsBySearch(availableRooms, roomSearch);
  }, [availableRooms, roomSearch]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [pinnedUsers, setPinnedUsers] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("chat_pinned_users");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error reading pinned users from localStorage:", error);
      return [];
    }
  });

  // Update localStorage when pinned users change
  useEffect(() => {
    try {
      localStorage.setItem("chat_pinned_users", JSON.stringify(pinnedUsers));
    } catch (error) {
      console.error("Error saving pinned users to localStorage:", error);
    }
  }, [pinnedUsers]);

  const togglePinUser = useCallback((userId: string) => {
    setPinnedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  }, []);

  // Add memoized calculation for total unread messages
  const totalUnreadMessages = useMemo(() => {
    // console.log(
    //   "All Users:",
    //   [...onlineUsers, ...offlineUsers].map((user) => ({
    //     id: user?.id,
    //     username: user?.username,
    //     status: onlineUsers.some((u) => u?.id === user?.id) ? "online" : "offline",
    //   })),
    // );
    return Object.entries(unreadMessages).reduce((sum, [userId, count]) => {
      // Only count unread messages from users (not rooms or global)
      const isUser = [...onlineUsers, ...offlineUsers].some((user) => user?.id === userId);
      return sum + (isUser ? count : 0);
    }, 0);
  }, [unreadMessages, onlineUsers, offlineUsers]);

  // Add save chat function
  const saveChatToText = useCallback(() => {
    if (!filteredMessages.length) return;

    // Sort messages by timestamp to ensure correct order
    const sortedMessages = [...filteredMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const formatMessage = (message: Message) => {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const sender = message.senderUsername || message.senderId;
      return `[${timestamp}] ${sender}: ${message.message}`;
    };

    // Generate filename based on chat type and current time
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    let chatType = "global";
    if (activeTab && activeTab.type === "direct") {
      const recipient = [...onlineUsers, ...offlineUsers].find((user) => user?.id === activeTab.recipientId);
      chatType = `dm-${recipient?.username || activeTab.recipientId}`;
    } else if (activeTab && activeTab.type === "room") {
      const room = availableRooms.find((r) => r.id === activeTab.roomId);
      chatType = `room-${room?.name || activeTab.roomId}`;
    }
    const filename = `chat-${chatType}-${now.toISOString().split("T")[0]}-${timeStr}.txt`;

    const chatContent = sortedMessages.map(formatMessage).join("\n");
    const blob = new Blob([chatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredMessages, activeTab, onlineUsers, offlineUsers, availableRooms]);

  // Modify the filtered users to include pinned users at the top
  const filteredUsers = useMemo(() => {
    const users = filterUsersBySearch(onlineUsers, userSearch);
    return users.sort((a, b) => {
      const isPinnedA = pinnedUsers.includes(a.id);
      const isPinnedB = pinnedUsers.includes(b.id);

      if (isPinnedA && !isPinnedB) return -1;
      if (!isPinnedA && isPinnedB) return 1;

      const unreadA = (unreadMessages[a.id] || 0) > 0;
      const unreadB = (unreadMessages[b.id] || 0) > 0;

      if (unreadA && !unreadB) return -1;
      if (!unreadA && unreadB) return 1;

      return (a.username || a.id).localeCompare(b.username || b.id);
    });
  }, [onlineUsers, userSearch, unreadMessages, pinnedUsers]);

  // Modify the filtered offline users to include pinned users at the top
  const filteredOfflineUsers = useMemo(() => {
    const users = filterUsersBySearch(offlineUsers, userSearch);
    return users.sort((a, b) => {
      const isPinnedA = pinnedUsers.includes(a.id);
      const isPinnedB = pinnedUsers.includes(b.id);

      if (isPinnedA && !isPinnedB) return -1;
      if (!isPinnedA && isPinnedB) return 1;

      const unreadA = (unreadMessages[a.id] || 0) > 0;
      const unreadB = (unreadMessages[b.id] || 0) > 0;

      if (unreadA && !unreadB) return -1;
      if (!unreadA && unreadB) return 1;

      return (a.username || a.id).localeCompare(b.username || b.id);
    });
  }, [offlineUsers, userSearch, unreadMessages, pinnedUsers]);

  // Update the usersWithUnreadMessages to include pinned users at the top
  const usersWithUnreadMessages = useMemo(() => {
    return [...filteredUsers, ...filteredOfflineUsers]
      .filter((user) => user && user?.id !== userId && (unreadMessages[user?.id] || 0) > 0)
      .sort((a, b) => {
        const isPinnedA = pinnedUsers.includes(a?.id || "");
        const isPinnedB = pinnedUsers.includes(b?.id || "");

        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;

        return (a?.username || a?.id).localeCompare(b?.username || b?.id);
      });
  }, [filteredUsers, filteredOfflineUsers, userId, unreadMessages, pinnedUsers]);

  // Update the onlineUsersWithoutUnread to include pinned users at the top
  const onlineUsersWithoutUnread = useMemo(() => {
    return filteredUsers
      .filter((user) => user && user?.id !== userId && !(unreadMessages[user?.id] || 0))
      .sort((a, b) => {
        const isPinnedA = pinnedUsers.includes(a?.id || "");
        const isPinnedB = pinnedUsers.includes(b?.id || "");

        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;

        return (a?.username || a?.id).localeCompare(b?.username || b?.id);
      });
  }, [filteredUsers, userId, unreadMessages, pinnedUsers]);

  // Update the offlineUsersWithoutUnread to include pinned users at the top
  const offlineUsersWithoutUnread = useMemo(() => {
    return filteredOfflineUsers
      .filter((user) => !(unreadMessages[user?.id] || 0))
      .sort((a, b) => {
        const isPinnedA = pinnedUsers.includes(a?.id || "");
        const isPinnedB = pinnedUsers.includes(b?.id || "");

        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;

        return (a?.username || a?.id).localeCompare(b?.username || b?.id);
      });
  }, [filteredOfflineUsers, unreadMessages, pinnedUsers]);

  const onlineUsersCount = useMemo(() => {
    return filteredUsers.filter((user) => !(unreadMessages[user?.id] || 0)).length;
  }, [filteredUsers, unreadMessages]);

  // Add effect to handle room message loading
  useEffect(() => {
    if (chatClient && activeTab && activeTab.type === "room" && activeTab.roomId) {
      chatLogger.log(`Requesting room message history for ${activeTab.roomId}`);
      _setIsLoadingMessagesLocal(true);

      // Request room history
      chatClient.getRoomHistory(activeTab.roomId);

      // Set a safety timeout to clear loading state if no response
      const safetyTimeout = setTimeout(() => {
        _setIsLoadingMessagesLocal(false);
      }, 5000);

      return () => clearTimeout(safetyTimeout);
    } else if (activeTab?.type !== "room") {
      // Clear loading state for non-room tabs
      _setIsLoadingMessagesLocal(false);
    }
  }, [chatClient, activeTab]);

  // Add ref for tabs container
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Add effect to scroll tabs container when tab changes
  useEffect(() => {
    if (tabsContainerRef.current && activeTab) {
      // Find the active tab element
      const activeTabElement = tabsContainerRef.current.querySelector(`[data-tab-id="${activeTab.id}"]`);
      if (activeTabElement) {
        // Scroll the active tab into view
        activeTabElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
      }
    }
  }, [activeTab, tabs]);

  // If username is not set, show login form
  if (!isUsernameSet) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-2 left-2 pointer-events-auto z-50">
        <CircleButton
          onClick={() => chatActions.setMinimized(false)}
          size="lg"
          // className="fixed bottom-2 left-2 pointer-events-auto" // Moved to parent div
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </CircleButton>
        {totalUnreadMessages > 0 && (
          <span className="absolute -top-1 -right-1 block h-5 w-5 rounded-full bg-red-500 bg-red/30 text-white text-xxs flex items-center justify-center">
            {totalUnreadMessages}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col md:flex-row bg-black/30 z-100 pointer-events-auto transition-all duration-300 ${
        isExpanded ? "h-[600px]" : "h-72"
      } ${isInputFocused ? "bg-black/60" : "bg-black/20"}`}
    >
      {/* Main Chat Area */}
      <div className={`flex flex-col flex w-[800px] max-w-[45vw]`}>
        {/* Chat Header */}
        <div className="flex flex-col flex-shrink-0 border-b border-gold/30 shadow-sm">
          {/* Tab Bar */}
          <div className="flex items-center relative">
            {/* Add Room Button */}
            <button
              onClick={() => {
                setIsRoomsVisible(!isRoomsVisible);
                setIsUsersVisible(false);
              }}
              className="flex items-center gap-1 px-2 py-1 text-gold/70 hover:text-gold transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm">Room</span>
            </button>

            {/* Add DM Button */}
            <button
              onClick={() => {
                setIsUsersVisible(!isUsersVisible);
                setIsRoomsVisible(false);
              }}
              className="flex items-center gap-1 px-2 py-1 text-gold/70 hover:text-gold transition-colors relative"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm">DM</span>
              {totalUnreadMessages > 0 && (
                <span className="absolute isolate -top-1 -right-1 block h-5 w-5 rounded-full bg-red-500 bg-red/30 text-white text-xxs flex items-center justify-center">
                  {totalUnreadMessages}
                </span>
              )}
            </button>

            {/* Active Tabs */}
            <div className="flex-1 flex overflow-x-auto scrollbar-none" ref={tabsContainerRef}>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  data-tab-id={tab.id}
                  className={`flex items-center gap-1 px-2 py-1 text-gold/70 hover:text-gold transition-colors border-r border-gold/30 ${
                    tab.id === activeTabId ? "bg-gold/20 text-gold" : ""
                  }`}
                >
                  <button onClick={() => chatActions.setActiveTab(tab.id)} className="flex items-center gap-1">
                    <span className="text-sm truncate max-w-[100px]">{tab.name}</span>
                    {unreadMessages[tab?.recipientId || ""] > 0 && (
                      <span className="ml-1 animate-pulse bg-red-500 text-white text-xxs px-2 bg-red/30 rounded-full">
                        {unreadMessages[tab?.recipientId || ""]}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      chatActions.removeTab(tab.id);
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-gold/20 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pr-2">
              <button
                onClick={saveChatToText}
                className="text-gold/70 hover:text-gold transition-colors p-1"
                title="Save chat to text file"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
              <button
                onClick={() => chatActions.toggleExpand()}
                className="text-gold/70 hover:text-gold transition-colors p-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isExpanded ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 14h6m0 0v6m0-6l-7 7m17-11h-6m0 0V4m0 6l7-7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 3h6v6M9 3H3v6m12 12h6v-6M3 15v6h6"
                    />
                  )}
                </svg>
              </button>
              <button
                onClick={() => chatActions.setMinimized(true)}
                className="text-gold/70 hover:text-gold transition-colors p-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Dropdowns */}
            {isRoomsVisible && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-brown/95 border border-gold/30 rounded shadow-lg z-50">
                <div className="p-2 border-b border-gold/30">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search rooms..."
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      className="w-full pl-2 py-1 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded text-sm"
                    />
                    {roomSearch && (
                      <button
                        onClick={() => setRoomSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gold/70 hover:text-gold transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {/* Global Chat Option */}
                  <button onClick={handleGlobalChatClick} className="w-full px-2 py-1 text-left hover:bg-gold/20">
                    <span className="text-sm">Game Chat</span>
                  </button>

                  {/* Rooms */}
                  {filteredRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => {
                        chatActions.addTab({
                          type: "room",
                          name: room.name || room.id,
                          roomId: room.id,
                        });
                        setIsRoomsVisible(false);
                      }}
                      className="w-full px-2 py-1 text-left hover:bg-gold/20"
                    >
                      <span className="text-sm">{room.name || room.id}</span>
                      {room.userCount && <span className="ml-2 text-xs bg-gold/20 px-1 rounded">{room.userCount}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isUsersVisible && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-brown/95 border border-gold/30 rounded shadow-lg z-50">
                <div className="p-2 border-b border-gold/30">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-2 py-1 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded text-sm"
                    />
                    {userSearch && (
                      <button
                        onClick={() => setUserSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gold/70 hover:text-gold transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {/* Users with unread messages */}
                  {usersWithUnreadMessages.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-gray-400">Unread Messages</div>
                      {usersWithUnreadMessages.map((user) => (
                        <UserItem
                          key={user?.id}
                          user={user}
                          isOffline={offlineUsers.some((u) => u?.id === user?.id)}
                          unreadCount={unreadMessages[user?.id] || 0}
                          isSelected={false}
                          isPinned={pinnedUsers.includes(user?.id)}
                          onSelect={(userId) => {
                            const username = [...onlineUsers, ...offlineUsers].find((u) => u?.id === userId)?.username;
                            chatActions.addTab({
                              type: "direct",
                              name: username || userId,
                              recipientId: userId,
                            });
                            setIsUsersVisible(false);
                          }}
                          onTogglePin={togglePinUser}
                        />
                      ))}
                    </div>
                  )}

                  {/* Online Users without unread messages */}
                  {onlineUsersWithoutUnread.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-gray-400">
                        Online Lords{" "}
                        <span className="bg-green-600/60 px-2 py-0.5 text-xs font-medium">{onlineUsersCount}</span>
                      </div>
                      {onlineUsersWithoutUnread.map((user) => (
                        <UserItem
                          key={user?.id}
                          user={user}
                          isOffline={false}
                          unreadCount={0}
                          isSelected={false}
                          isPinned={pinnedUsers.includes(user?.id)}
                          onSelect={(userId) => {
                            const username = [...onlineUsers, ...offlineUsers].find((u) => u?.id === userId)?.username;
                            chatActions.addTab({
                              type: "direct",
                              name: username || userId,
                              recipientId: userId,
                            });
                            setIsUsersVisible(false);
                          }}
                          onTogglePin={togglePinUser}
                        />
                      ))}
                    </div>
                  )}

                  {/* Offline Users without unread messages */}
                  {offlineUsersWithoutUnread.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-gray-400">Offline</div>
                      {offlineUsersWithoutUnread.map((user) => (
                        <UserItem
                          key={user?.id}
                          user={user}
                          isOffline={true}
                          unreadCount={0}
                          isSelected={false}
                          isPinned={pinnedUsers.includes(user?.id)}
                          onSelect={(userId) => {
                            const username = [...onlineUsers, ...offlineUsers].find((u) => u?.id === userId)?.username;
                            chatActions.addTab({
                              type: "direct",
                              name: username || userId,
                              recipientId: userId,
                            });
                            setIsUsersVisible(false);
                          }}
                          onTogglePin={togglePinUser}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages display */}
        <div className={`flex-1 overflow-y-auto p-1 flex flex-col transition-all duration-300`} ref={chatContainerRef}>
          {isStoreLoadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="animate-spin h-8 w-8 border-3 border-orange-500 rounded-full border-t-transparent mb-4"></div>
              <p className="text-gray-400">Loading messages...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 md:h-12 md:w-12 mb-2 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {activeTab?.type === "direct" ? (
                <p>No direct messages yet</p>
              ) : activeTab?.type === "room" ? (
                <p>No messages yet in this room</p>
              ) : (
                <p>Join a room to start chatting</p>
              )}
            </div>
          ) : (
            <>
              {/* Spacer to push content to bottom when there are few messages */}
              <div className="flex-grow" />

              <div
                className={`space-y-1 transition-opacity duration-500 ${
                  shouldShowTransition ? (isInitialScrollComplete ? "opacity-100" : "opacity-0") : "opacity-100"
                }`}
              >
                {messageGroups.map((group, groupIndex) => {
                  const groupKey = `${group.messages[0]?.id || "empty"}-${groupIndex}`;
                  return (
                    <MessageGroupComponent
                      key={groupKey}
                      group={group}
                      userId={userId}
                      selectRecipient={(userId) => {
                        const username = [...onlineUsers, ...offlineUsers].find((u) => u?.id === userId)?.username;
                        chatActions.addTab({
                          type: "direct",
                          name: username || userId,
                          recipientId: userId,
                        });
                      }}
                    />
                  );
                })}
                <div ref={messagesEndRef} style={{ height: "", clear: "both" }} />
              </div>
            </>
          )}
        </div>

        {/* Message input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onFocusChange={setIsInputFocused}
          isRecipientOffline={
            activeTab?.type === "direct" ? offlineUsers.some((user) => user?.id === activeTab.recipientId) : false
          }
          recipientUsername={
            activeTab?.type === "direct"
              ? [...onlineUsers, ...offlineUsers].find((user) => user?.id === activeTab.recipientId)?.username
              : undefined
          }
        />
      </div>
    </div>
  );
}

export default ChatModule;
