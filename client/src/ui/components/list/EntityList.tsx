import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import { DUMMY_HYPERSTRUCTURE_ENTITY_ID } from "@/three/scenes/constants";
import Button from "@/ui/elements/Button";
import { ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { NavigateToPositionIcon } from "../military/ArmyChip";
import { ViewOnMapIcon } from "../military/ArmyManagementCard";

interface EntityListProps {
  title: string;
  headerPanel?: React.ReactElement;
  panel: (props: {
    entity: any;
    previous?: undefined | any[];
    setSelectedEntity?: (entity: any) => void;
  }) => React.ReactElement;
  list: any[];
  previous?: any[];
  current?: ID;
  entityContent?: (props: { id: any }) => React.ReactElement | null;
  questing?: boolean;
  className?: string;
  extraBackButtonContent?: React.ReactElement;
  filterEntityIds?: ID[]; // Add new prop for filtering entity IDs
}

export const EntityList = ({
  title,
  panel,
  list,
  headerPanel,
  current,
  entityContent,
  questing,
  className,
  extraBackButtonContent,
  filterEntityIds,
}: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const entity = list.find((entity) => entity.entity_id === current);
    if (entity) setSelectedEntity(entity || null);
  }, [current]);

  const filteredList = list
    .filter(
      (entity) =>
        entity.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .filter((entity) => !filterEntityIds || filterEntityIds.includes(entity.entity_id));

  return (
    <div>
      {selectedEntity ? (
        <>
          {extraBackButtonContent}
          <div className="p-2">
            <Button className="mb-3" variant="default" size="xs" onClick={() => setSelectedEntity(null)}>
              {"<"} Back to {title}
            </Button>
            {panel({ entity: list.find((entity) => entity.entity_id === selectedEntity.entity_id), setSelectedEntity })}
          </div>
        </>
      ) : (
        <div className={clsx("p-2", className)}>
          {headerPanel}
          <input
            type="text"
            placeholder="Search by name or owner..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            className="w-full p-2 mb-2 bg-gold/10 border border-gold/20 rounded text-gold placeholder-gold/50 focus:outline-none focus:border-gold/40"
          />
          <ul>
            {filteredList.map((entity) => (
              <li
                className={clsx("py-2 px-2 bg-gold/20 hover:bg-crimson/40 my-1 rounded border border-gold/10", {
                  "animate-pulse pointer-events-none": questing || entity.id === Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
                })}
                key={entity.id}
                onClick={() => setSelectedEntity(entity)}
              >
                <div className="flex flex-col space-y-2">
                  <div className="flex flex-row justify-between items-center">
                    <div className="flex flex-row space-x-5 items-center">
                      <h5>{entity.name}</h5>
                      <div className="flex flex-row ">
                        {entity?.position && <ViewOnMapIcon className={"my-auto"} position={entity.position} />}
                        {entity?.position && <NavigateToPositionIcon className="h-6 w-6" position={entity?.position} />}
                      </div>
                    </div>
                    <ArrowRight className="w-2 fill-current" />
                  </div>

                  {entity.id !== Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID) && (
                    <div className="border border-gold/20 bg-gold/10 rounded p-2">
                      {entityContent && entityContent(entity.id)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
