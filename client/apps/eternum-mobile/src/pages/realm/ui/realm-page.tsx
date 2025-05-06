import { useStore } from "@/shared/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { RealmInfoHeader } from "@/widgets/realm-info-header";
import { usePlayerOwnedRealmsInfo, usePlayerOwnedVillagesInfo } from "@bibliothecadao/react";
import { createContext, useContext, useEffect, useState } from "react";
import { ClaimTab, MilitaryTab, OverviewTab, ProductionTab } from "./tabs";

interface RealmTabsContextType {
  switchTab: (tab: string) => void;
}

export const RealmTabsContext = createContext<RealmTabsContextType>({ switchTab: () => {} });

export const useRealmTabs = () => {
  const context = useContext(RealmTabsContext);
  if (!context) {
    throw new Error("useRealmTabs must be used within RealmTabsContext");
  }
  return context;
};

export const RealmPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const playerRealms = usePlayerOwnedRealmsInfo();
  const playerVillages = usePlayerOwnedVillagesInfo();
  const { selectedRealm, setSelectedStructure } = useStore();
  const [hasNoStructures, setHasNoStructures] = useState(false);

  // Set initial structure on load
  useEffect(() => {
    if (!selectedRealm) {
      if (playerRealms.length > 0) {
        setSelectedStructure(playerRealms[0]);
        setHasNoStructures(false);
      } else if (playerVillages.length > 0) {
        setSelectedStructure(playerVillages[0]);
        setHasNoStructures(false);
      } else {
        setHasNoStructures(true);
      }
    }
  }, [playerRealms, playerVillages, selectedRealm, setSelectedStructure]);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
  };

  if (hasNoStructures) {
    return (
      <div className="container p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center">No Realms or Villages Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-muted-foreground">Please open the desktop client to settle a realm or village.</p>
            <p className="text-sm text-muted-foreground">Mobile settling functionality coming soon!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RealmTabsContext.Provider value={{ switchTab }}>
      <div className="container p-4 space-y-4">
        <RealmInfoHeader />

        <Tabs value={activeTab} onValueChange={switchTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="military">Military</TabsTrigger>
            <TabsTrigger value="claim">Claim</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="production" className="mt-4">
            <ProductionTab />
          </TabsContent>

          <TabsContent value="military" className="mt-4">
            <MilitaryTab />
          </TabsContent>

          <TabsContent value="claim" className="mt-4">
            <ClaimTab />
          </TabsContent>
        </Tabs>
      </div>
    </RealmTabsContext.Provider>
  );
};
