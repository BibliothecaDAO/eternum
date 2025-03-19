import { Button } from "@/shared/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { resources } from "@bibliothecadao/eternum";
import { Search } from "lucide-react";
import { ReactNode, useState } from "react";

interface Resource {
  id: number;
  trait: string;
  balance?: number;
}

interface ResourceSelectDrawerProps {
  selectedResource: Resource | undefined;
  onResourceSelect: (resourceId: number) => void;
  showBalance?: boolean;
  children: ReactNode;
}

export const ResourceSelectDrawer = ({
  selectedResource,
  onResourceSelect,
  showBalance = true,
  children,
}: ResourceSelectDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Dummy balance for demonstration - this should be replaced with actual balance data
  const getBalance = () => Math.floor(Math.random() * 1000);

  const filteredResources = resources.filter((resource) =>
    resource.trait.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Drawer>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-3xl font-bokor text-center">Select Resource</DrawerTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </DrawerHeader>
        <ScrollArea className="h-[50vh] px-4">
          <div className="space-y-2">
            {filteredResources.map((resource) => (
              <DrawerClose key={resource.id} asChild>
                <Button variant="ghost" className="w-full justify-start" onClick={() => onResourceSelect(resource.id)}>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={resource.id} size={24} />
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{resource.trait}</span>
                      {showBalance && <span className="text-xs text-muted-foreground">Balance: {getBalance()}</span>}
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
};
