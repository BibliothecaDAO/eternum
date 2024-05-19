import { resources } from "@bibliothecadao/eternum";
import { ModalContainer } from "../ModalContainer";
import { useMemo, useState } from "react";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { MarketOrderPanel, MarketResource } from "./MarketOrderPanel";

export const MarketModal = () => {
  return (
    <ModalContainer>
      <div className="container border mx-auto  grid grid-cols-12 my-8">
        <div className="col-span-12 h-16 border"></div>

        <div className="col-span-2 border ">
          <MarketResourceSidebar search={""} />
        </div>
        <div className="col-span-10">
          <MarketOrderPanel />
        </div>
      </div>
    </ModalContainer>
  );
};

export const MarketResourceSidebar = ({ search }: { search: string }) => {
  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      return resource.trait.toLowerCase().includes(search.toLowerCase());
    });
  }, []);

  return (
    <div className="flex flex-col">
      {filteredResources.map((resource) => {
        return <MarketResource key={resource.id} />;
      })}
    </div>
  );
};
