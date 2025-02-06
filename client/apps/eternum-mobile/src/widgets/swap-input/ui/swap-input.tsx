import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { resources } from "@bibliothecadao/eternum";
import { Search } from "lucide-react";
import { useState } from "react";

interface SwapInputProps {
  direction: "buy" | "sell";
  resourceId: number;
  amount: number;
  onAmountChange?: (amount: number) => void;
  onResourceChange?: (resourceId: number) => void;
}

export const SwapInput = ({ direction, resourceId, amount, onAmountChange, onResourceChange }: SwapInputProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  // Dummy balance for demonstration
  const balance = Math.floor(Math.random() * 1000);

  const handlePercentageClick = (percentage: number) => {
    onAmountChange?.(Math.floor((balance * percentage) / 100));
  };

  const selectedResource = resources.find((r) => r.id === resourceId);
  const filteredResources = resources.filter((resource) =>
    resource.trait.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Top section */}
        <div className="flex justify-between items-center">
          <div className="text-lg font-medium capitalize">{direction}</div>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between">
                <div className="flex items-center gap-2">
                  {selectedResource && <ResourceIcon resourceId={selectedResource.id} size={20} />}
                  <span>{selectedResource?.trait}</span>
                </div>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Select Resource</DrawerTitle>
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
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onResourceChange?.(resource.id)}
                      >
                        <div className="flex items-center gap-2">
                          <ResourceIcon resourceId={resource.id} size={24} />
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{resource.trait}</span>
                            <span className="text-xs text-muted-foreground">Balance: {balance}</span>
                          </div>
                        </div>
                      </Button>
                    </DrawerClose>
                  ))}
                </div>
              </ScrollArea>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Middle section - Amount input */}
        <Input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange?.(Number(e.target.value))}
          className="text-2xl h-16 text-center"
          placeholder="0.0"
        />

        {/* Bottom section */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Balance: {balance} {selectedResource?.trait}
          </div>
          <div className="flex gap-1">
            {[10, 25, 50, 100].map((percentage) => (
              <Button key={percentage} variant="secondary" size="sm" onClick={() => handlePercentageClick(percentage)}>
                {percentage === 100 ? "All" : `${percentage}%`}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
