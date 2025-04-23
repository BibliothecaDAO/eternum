import { useResourceBalances } from "@/features/resource-balances/model/use-resource-balances";
import { currencyFormat } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ID, resources } from "@bibliothecadao/types";
import { Search } from "lucide-react";
import { ReactNode, useState } from "react";

interface ResourceSelectDrawerProps {
  onResourceSelect: (resourceId: number) => void;
  showBalance?: boolean;
  children: ReactNode;
  entityId: ID;
}

export const ResourceSelectDrawer = ({
  onResourceSelect,
  showBalance = true,
  children,
  entityId,
}: ResourceSelectDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { resourceAmounts } = useResourceBalances(entityId);

  const filteredResources = resources.filter((resource) =>
    resource.trait.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
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
                      {showBalance && (
                        <span className="text-xs text-muted-foreground">
                          Balance: {currencyFormat(resourceAmounts.find((r) => r.id === resource.id)?.amount || 0)}
                        </span>
                      )}
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
