import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { DMChat } from "../dm-chat";

interface User {
  id: string;
  name: string;
  guild: string;
  avatar?: string;
  online: boolean;
  unreadCount?: number;
}

interface DMTabProps {
  onNewDMClick: () => void;
  selectedUser: User | null;
  onClearSelectedUser: () => void;
}

const dummyUsers: User[] = [
  {
    id: "1",
    name: "Alice",
    guild: "Knights of the Round Table",
    online: true,
    unreadCount: 3,
  },
  {
    id: "2",
    name: "Bob",
    guild: "Dragon Slayers",
    online: false,
    unreadCount: 0,
  },
  {
    id: "3",
    name: "Charlie",
    guild: "Mage Academy",
    online: true,
    unreadCount: 2,
  },
];

export function DMTab({ onNewDMClick, selectedUser, onClearSelectedUser }: DMTabProps) {
  const [users, setUsers] = useState<User[]>(dummyUsers);
  const [activeUser, setActiveUser] = useState<User | null>(null);

  // Handle selected user from drawer
  useEffect(() => {
    if (selectedUser) {
      const existingUser = users.find((u) => u.id === selectedUser.id);
      if (!existingUser) {
        setUsers((prev) => [...prev, { ...selectedUser, unreadCount: 0 }]);
      }
      setActiveUser(selectedUser);
    }
  }, [selectedUser]);

  const handleUserClick = (user: User) => {
    setActiveUser(user);
  };

  const handleCloseDM = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setUsers((prev) => prev.filter((user) => user.id !== userId));
    if (activeUser?.id === userId) {
      setActiveUser(null);
      onClearSelectedUser();
    }
  };

  if (activeUser) {
    return (
      <DMChat
        user={activeUser}
        onBack={() => {
          setActiveUser(null);
          onClearSelectedUser();
        }}
        onMentionClick={onNewDMClick}
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <Button variant="outline" className="w-full" onClick={onNewDMClick}>
        Start New DM
      </Button>

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
              onClick={() => handleUserClick(user)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                      user.online ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-sm text-muted-foreground">{user.guild}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {user.unreadCount ? <Badge variant="secondary">{user.unreadCount}</Badge> : null}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleCloseDM(e, user.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
