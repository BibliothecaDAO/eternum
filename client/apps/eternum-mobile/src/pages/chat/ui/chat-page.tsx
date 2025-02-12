import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useState } from "react";
import { DMDrawer } from "./dm-drawer";
import { DMTab } from "./tabs/dm-tab";
import { EventsTab } from "./tabs/events-tab";
import { GlobalChatTab } from "./tabs/global-chat-tab";

interface User {
  id: string;
  name: string;
  guild: string;
  avatar?: string;
  online: boolean;
}

type TabType = "global" | "events" | "dm";

export function ChatPage() {
  const [activeTab, setActiveTab] = useState<TabType>("global");
  const [isDMDrawerOpen, setIsDMDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setActiveTab("dm");
    setIsDMDrawerOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs
        defaultValue="global"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        className="w-full"
      >
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="events" className="relative">
            Events
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center z-10">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="dm" className="relative">
            DM
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center z-10">5</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="global" className="h-full m-0">
            <GlobalChatTab onMentionClick={() => setIsDMDrawerOpen(true)} />
          </TabsContent>

          <TabsContent value="events" className="h-full m-0">
            <EventsTab />
          </TabsContent>

          <TabsContent value="dm" className="h-full m-0">
            <DMTab
              onNewDMClick={() => setIsDMDrawerOpen(true)}
              selectedUser={selectedUser}
              onClearSelectedUser={() => setSelectedUser(null)}
            />
          </TabsContent>
        </div>
      </Tabs>

      <DMDrawer isOpen={isDMDrawerOpen} onClose={() => setIsDMDrawerOpen(false)} onSelectUser={handleSelectUser} />
    </div>
  );
}
