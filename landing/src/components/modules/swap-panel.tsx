import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BridgeIn } from "./bridge-in";
import { BridgeOutStep1 } from "./bridge-out-step-1";
import { BridgeOutStep2 } from "./bridge-out-step-2";

export const SwapPanel = () => {
  return (
    <div>
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
        <TabsContent className="border-2 rounded-xl bg-brown border-gold/15 round-tr-none" value="in">
          <BridgeIn />
        </TabsContent>
        <TabsContent className="border-2 rounded-xl bg-brown border-gold/15 round-tr-none" value="out-start">
          <BridgeOutStep1 />
        </TabsContent>
        <TabsContent className="border-2 rounded-xl bg-brown border-gold/15 round-tr-none" value="out-finish">
          <BridgeOutStep2 />
        </TabsContent>
      </Tabs>
    </div>
  );
};
