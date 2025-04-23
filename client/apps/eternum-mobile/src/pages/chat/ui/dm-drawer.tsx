import { Button } from "@/shared/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Search } from "lucide-react";
import { useState } from "react";

interface User {
  id: string;
  username?: string;
  is_online?: boolean;
}

interface DMDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  onlineUsers: User[];
  offlineUsers: User[];
}

export function DMDrawer({ isOpen, onClose, onSelectUser, onlineUsers, offlineUsers }: DMDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOnlineUsers = onlineUsers.filter((user) =>
    (user.username || user.id).toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredOfflineUsers = offlineUsers.filter((user) =>
    (user.username || user.id).toLowerCase().includes(searchQuery.toLowerCase()),
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
          {filteredOnlineUsers.length === 0 && filteredOfflineUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users match your search</div>
          ) : (
            <div className="space-y-4">
              {/* Online Users */}
              {filteredOnlineUsers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Online</h3>
                  <div className="space-y-2">
                    {filteredOnlineUsers.map((user) => (
                      <DrawerClose key={user.id} asChild>
                        <Button variant="ghost" className="w-full justify-start" onClick={() => onSelectUser(user.id)}>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                                {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
                              </div>
                              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background bg-green-500" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{user.username || user.id}</span>
                            </div>
                          </div>
                        </Button>
                      </DrawerClose>
                    ))}
                  </div>
                </div>
              )}

              {/* Offline Users */}
              {filteredOfflineUsers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Offline</h3>
                  <div className="space-y-2">
                    {filteredOfflineUsers.map((user) => (
                      <DrawerClose key={user.id} asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start opacity-60"
                          onClick={() => onSelectUser(user.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                                {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
                              </div>
                              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background bg-gray-400" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{user.username || user.id}</span>
                            </div>
                          </div>
                        </Button>
                      </DrawerClose>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
