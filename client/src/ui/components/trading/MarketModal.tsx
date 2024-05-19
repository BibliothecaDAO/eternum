import { resources } from "@bibliothecadao/eternum";
import { ModalContainer } from "../ModalContainer";
import { useMemo, useState } from "react";
import { MarketOrderPanel, MarketResource } from "./MarketOrderPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { useEntities } from "@/hooks/helpers/useEntities";
import useRealmStore from "@/hooks/store/useRealmStore";

export const MarketModal = () => {
  const { playerRealms } = useEntities();

  const { realmEntityId, setRealmEntityId } = useRealmStore();

  const [selectedResource, setSelectedResource] = useState<number>(1);

  return (
    <ModalContainer>
      <div className="container border mx-auto  grid grid-cols-12 my-8">
        <div className="col-span-12 border p-2">
          <div className="self-center">
            <Select value={realmEntityId.toString()} onValueChange={(trait) => setRealmEntityId(BigInt(trait))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Realm" />
              </SelectTrigger>
              <SelectContent className="bg-brown text-gold">
                {playerRealms().map((realm, index) => (
                  <SelectItem key={index} value={realm.entity_id?.toString() || ""}>
                    {realm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="col-span-3 p-1">
          {/* <TextInput value="Search Resource" onChange={() => console.log("s")} /> */}
          <MarketResourceSidebar
            search={""}
            onClick={(value) => setSelectedResource(value)}
            selectedResource={selectedResource}
          />
        </div>
        <div className="col-span-9">
          <MarketOrderPanel />
        </div>
      </div>
    </ModalContainer>
  );
};

export const MarketResourceSidebar = ({
  search,
  onClick,
  selectedResource,
}: {
  search: string;
  onClick: (value: number) => void;
  selectedResource: number;
}) => {
  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      return resource.trait.toLowerCase().includes(search.toLowerCase());
    });
  }, []);

  return (
    <div className="flex flex-col">
      {filteredResources.map((resource) => {
        return (
          <MarketResource
            key={resource.id}
            resource={resource}
            active={selectedResource == resource.id}
            onClick={onClick}
          />
        );
      })}
    </div>
  );
};
