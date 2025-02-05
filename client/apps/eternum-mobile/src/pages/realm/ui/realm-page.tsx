import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { RealmInfoHeader } from "@/widgets/realm-info-header";
import { RealmLevels } from "@bibliothecadao/eternum";
import { ClaimTab, ManageTab, MilitaryTab, OverviewTab } from "./tabs";

export const RealmPage = () => {
  return (
    <div className="container p-4 space-y-4">
      <RealmInfoHeader
        realmName="Uw Rohi"
        realmLevel={RealmLevels.Kingdom}
        realmProgress={33}
        balance={1000}
        coordinates={{ x: 10, y: 10 }}
        realmNumber={6132}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="military">Military</TabsTrigger>
          <TabsTrigger value="claim">Claim</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <ManageTab />
        </TabsContent>

        <TabsContent value="military" className="mt-4">
          <MilitaryTab />
        </TabsContent>

        <TabsContent value="claim" className="mt-4">
          <ClaimTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
