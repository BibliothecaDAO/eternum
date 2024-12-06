import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import Button from "@/ui/elements/Button";
import { ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useEffect, useState } from "react";
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
}: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  useEffect(() => {
    const entity = list.find((entity) => entity.entity_id === current);
    if (entity) setSelectedEntity(entity || null);
  }, [current]);

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
          <ul>
            {list.map((entity, index) => (
              <li
                className={clsx("py-2 px-2 bg-gold/20 hover:bg-crimson/40 my-1 rounded border border-gold/10", {
                  "animate-pulse": questing,
                })}
                key={index}
                onClick={() => setSelectedEntity(entity)}
              >
                <div className="flex flex-col space-y-2">
                  <div className="flex flex-row justify-between items-center">
                    <div className="flex flex-row space-x-1 items-center">
                      {entity?.position && <ViewOnMapIcon className={"my-auto"} position={entity.position} />}
                      <h4>{entity.name}</h4>
                    </div>
                    <ArrowRight className="w-2 fill-current" />
                  </div>

                  <div>{entityContent && entityContent(entity.id)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
