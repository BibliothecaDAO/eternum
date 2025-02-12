import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { Search } from "lucide-react";
import { User } from "../types";

interface UserSearchDrawerProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredUsers: User[];
  onUserSelect: (user: User) => void;
}

export const UserSearchDrawer = ({
  searchQuery,
  onSearchChange,
  filteredUsers,
  onUserSelect,
}: UserSearchDrawerProps) => {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>New Message</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select User</DrawerTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </DrawerHeader>
        <div className="p-4 pt-0">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-4 p-4 hover:bg-accent rounded-lg cursor-pointer"
              onClick={() => onUserSelect(user)}
            >
              <div className="relative">
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded" />
                {user.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                )}
              </div>
              <div>
                <div className="font-medium">{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.guild}</div>
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
