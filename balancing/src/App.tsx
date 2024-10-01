import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resources } from "@bibliothecadao/eternum";
import "./App.css";
import { BuildingTable } from "./components/modules/building-table";
import { ResourceTable } from "./components/modules/resource-table";

function App() {
  return (
    <>
      <div className="bg-black text-white">
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="resources">Production</TabsTrigger>
            <TabsTrigger value="buildings">Buildings</TabsTrigger>
          </TabsList>

          <TabsContent value="resources">
            <ResourceTable resources={resources} />
          </TabsContent>

          <TabsContent value="buildings">
            <BuildingTable />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default App;
