import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useState } from "react";
import { useLocation } from "wouter";
import { Message, User } from "../types";
import { ChatContent } from "./chat-content";
import { ChatInput } from "./chat-input";
import { UserList } from "./user-list";
import { UserSearchDrawer } from "./user-search-drawer";

// Dummy data
const messages: Message[] = [
  { id: 1, sender: "Player1", content: "Hello everyone!", timestamp: "10:00" },
  { id: 2, sender: "Player2", guild: "Guild1", content: "Hey there!", timestamp: "10:01" },
  // Add more messages as needed
];

const users: User[] = [
  {
    id: 1,
    name: "Player1",
    guild: "Guild1",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
    online: true,
    unreadCount: 3,
  },
  // Add more users as needed
];

export const ChatPage = () => {
  const [location, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState(messages);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: chatMessages.length + 1,
      sender: "You",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages([...chatMessages, newMessage]);
    setMessage("");
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.guild.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="container">
      {selectedUser ? (
        // DM Chat View
        <div className="flex flex-col h-full">
          <div className="flex items-center p-4 border-b">
            <Button variant="ghost" onClick={() => setSelectedUser(null)} className="mr-2">
              ←
            </Button>
            <h1 className="font-bokor text-xl">{selectedUser.name}</h1>
          </div>
          <ChatContent messages={chatMessages} />
          <ChatInput message={message} setMessage={setMessage} onSend={handleSend} />
        </div>
      ) : (
        // Main Chat View
        <Tabs defaultValue="global" className="h-full flex flex-col mt-4">
          <div className="border-b px-4">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="global" className="flex-1">
                Global
              </TabsTrigger>
              <TabsTrigger value="events" className="flex-1">
                Events
                <Badge variant="secondary" className="ml-2">
                  2
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="dm" className="flex-1">
                DM
                <Badge variant="secondary" className="ml-2">
                  5
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="global" className="flex-1 flex flex-col">
            <ChatContent messages={chatMessages} />
            <ChatInput message={message} setMessage={setMessage} onSend={handleSend} />
          </TabsContent>

          <TabsContent value="events" className="flex-1">
            <div className="p-4">Events chat coming soon...</div>
          </TabsContent>

          <TabsContent value="dm" className="flex-1 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Direct Messages</h3>
              <UserSearchDrawer
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filteredUsers={filteredUsers}
                onUserSelect={setSelectedUser}
              />
            </div>

            <UserList users={users} onUserSelect={setSelectedUser} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
