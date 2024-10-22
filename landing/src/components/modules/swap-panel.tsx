import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Swap } from "./swap";

export const SwapPanel = () => {
  return (
    <div className="border-2 rounded-xl p-3 bg-brown border-gold/15 round-tr-none rounded-bl-none">
      <Tabs defaultValue="account">
        <TabsList className="w-full">
          <TabsTrigger className="w-full" value="account">
            Bridge In
          </TabsTrigger>
          <TabsTrigger className="w-full" value="password">
            Bridge Out
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <Swap />
        </TabsContent>
        <TabsContent value="password">
          <Swap />
        </TabsContent>
      </Tabs>
    </div>
  );
};
