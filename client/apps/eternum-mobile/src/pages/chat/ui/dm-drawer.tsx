import { Button } from "@/shared/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Search } from "lucide-react";
import { useState } from "react";

interface User {
  id: string;
  name: string;
  guild: string;
  avatar?: string;
  online: boolean;
}

interface DMDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

const dummyUsers: User[] = [
  {
    id: "1",
    name: "Alice",
    guild: "Knights of the Round Table",
    online: true,
  },
  {
    id: "2",
    name: "Bob",
    guild: "Dragon Slayers",
    online: false,
  },
  {
    id: "3",
    name: "Charlie",
    guild: "Mage Academy",
    online: true,
  },
  // Add more dummy users here
];

export function DMDrawer({ isOpen, onClose, onSelectUser }: DMDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users] = useState<User[]>(dummyUsers);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.guild.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-3xl font-bokor text-center">Select User</DrawerTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </DrawerHeader>
        <ScrollArea className="h-[50vh] px-4">
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <DrawerClose key={user.id} asChild>
                <Button variant="ghost" className="w-full justify-start" onClick={() => onSelectUser(user)}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-muted rounded-full" />
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                          user.online ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-sm text-muted-foreground">{user.guild}</span>
                    </div>
                  </div>
                </Button>
              </DrawerClose>
            ))}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
