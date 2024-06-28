import { Realm } from "@/hooks/helpers/useStructures";
import { Headline } from "@/ui/elements/Headline";
import { findResourceById, orderNameDict } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { RealmExtended } from "../../../../hooks/helpers/useRealm";
import { OrderIcon } from "../../../elements/OrderIcon";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { InventoryResources } from "../../resources/InventoryResources";
import { useState } from "react";

type RealmListItemProps = {
  realm: Realm | RealmExtended;
  onClick?: () => void;
  extraButton?: JSX.Element;
};

export const RealmListItem = ({ realm, onClick, extraButton }: RealmListItemProps) => {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="flex flex-col clip-angled-sm bg-gold/20 p-3 max-h-[40vh] overflow-y-auto">
      <div className="flex items-center">
        {realm && (
          <div className="flex items-center p-1  border-gold font-bold  w-full">
            <Headline className="text-gold ">
              <div className="flex">
                {realm.order && <OrderIcon order={orderNameDict[realm.order]} size="xs" className="mr-1" />}
                <div>{realm.name}</div>
              </div>
            </Headline>
          </div>
        )}
      </div>
      <div className="flex items-end mt-2">
        <div className={clsx("flex items-center justify-around flex-1")}>
          <div className="flex-1 text-gold flex items-center flex-wrap">
            <div className="grid grid-cols-8 uppercase w-full font-bold mb-1">Produces</div>
            {realm.resources &&
              realm.resources.map((resourceId: number) => (
                <div className="flex flex-col items-center mx-2 my-0.5" key={resourceId}>
                  <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="md" className="mb-1" />
                </div>
              ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-10 uppercase w-full font-bold my-3">Inventory</div>
      <InventoryResources
        max={showAll ? Infinity : 10}
        className="grid grid-cols-10 gap-1 mb-2"
        entityId={BigInt(realm.entity_id)}
        setShowAll={setShowAll}
      />
      {extraButton || ""}
    </div>
  );
};
