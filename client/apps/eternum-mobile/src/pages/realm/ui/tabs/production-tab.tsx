import { useStore } from "@/shared/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import AddBuildingWidget from "@/widgets/add-building";
import { useState } from "react";
import { ProductionWidgetsSection } from "../components/production-widgets-section";

export function ProductionTab() {
  const selectedRealm = useStore((state) => state.selectedRealm);
  const [activeTab, setActiveTab] = useState("manage");
  const structureEntityId = useStore((state) => state.structureEntityId);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="mt-4">
          {selectedRealm && <ProductionWidgetsSection selectedRealm={selectedRealm} isVertical={true} />}
        </TabsContent>

        <TabsContent value="build" className="mt-4">
          <AddBuildingWidget entityId={structureEntityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
