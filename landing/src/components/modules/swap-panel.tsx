import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BridgeOutStep1 } from "./bridge-out-step-1";
import { BridgeOutStep2 } from "./bridge-out-step-2";
import { Swap } from "./swap";

export const SwapPanel = () => {
  return (
    <div className="border-2 rounded-xl p-3 bg-brown border-gold/15 round-tr-none rounded-bl-none">
      <Tabs defaultValue="in">
        <TabsList className="w-full">
          <TabsTrigger className="w-full" value="in">
            Bridge In
          </TabsTrigger>
          <TabsTrigger className="w-full" value="out-start">
            Bridge Out
          </TabsTrigger>
          <TabsTrigger className="w-full" value="out-finish">
            Bridge Out (Finish)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="in">
          <Swap />
        </TabsContent>
        <TabsContent value="out-start">
          <BridgeOutStep1 />
        </TabsContent>
        <TabsContent value="out-finish">
          <BridgeOutStep2 />
        </TabsContent>
      </Tabs>
    </div>
  );
};
1;
