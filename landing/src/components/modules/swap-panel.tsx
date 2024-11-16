import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Button } from "../ui/button";
import { LordsPurchaseDialog } from "./lords-purchase-dialog";
import { Swap } from "./swap";

export const SwapPanel = () => {
  const [isLordsPurchaseDialogOpen, setIsLordsPurchaseDialogOpen] = useState(false);
  return (
    <div className="border-2 rounded-xl p-3 bg-brown border-gold/15 round-tr-none rounded-bl-none">
      <Tabs defaultValue="in">
        <TabsList className="w-full">
          <TabsTrigger className="w-full" value="in">
            Bridge In
          </TabsTrigger>
          <TabsTrigger className="w-full" value="out">
            Bridge Out
          </TabsTrigger>
        </TabsList>
        <TabsContent value="in">
          <Swap />
        </TabsContent>
        <TabsContent value="out">
          <Swap />
        </TabsContent>
      </Tabs>
      <Button onClick={() => setIsLordsPurchaseDialogOpen(true)}>Buy Lords</Button>
      <LordsPurchaseDialog isOpen={isLordsPurchaseDialogOpen} setIsOpen={setIsLordsPurchaseDialogOpen} />

    </div>
  );
};
1;
