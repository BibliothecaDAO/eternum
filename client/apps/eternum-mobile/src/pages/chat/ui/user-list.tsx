import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { User } from "../types";

interface UserListProps {
  users: User[];
  onUserSelect: (user: User) => void;
}

export const UserList = ({ users, onUserSelect }: UserListProps) => {
  return (
    <ScrollArea className="h-[calc(100vh-16rem)]">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between p-4 hover:bg-accent rounded-lg cursor-pointer"
          onClick={() => onUserSelect(user)}
        >
          <div className="flex items-center gap-4">
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
          {user.unreadCount > 0 && <Badge>{user.unreadCount}</Badge>}
        </div>
      ))}
    </ScrollArea>
  );
};
