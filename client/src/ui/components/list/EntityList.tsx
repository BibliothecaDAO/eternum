import React, { useEffect, useState } from "react";
import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import Button from "@/ui/elements/Button";

interface EntityListProps {
  title: string;
  headerPanel?: React.ReactElement;
  panel: (props: { entity: any; previous?: undefined | any[] }) => React.ReactElement;
  list: any[];
  previous?: any[];
  current?: bigint;
}

export const EntityList = ({ title, panel, list, headerPanel, current }: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState<bigint | null>(null);

  useEffect(() => {
    const entity = list.find((entity) => entity.entity_id === current);
    if (entity) setSelectedEntity(entity || null);
  }, [current]);

  return (
    <div>
      {selectedEntity ? (
        <div className="p-2">
          <Button className="mb-3" variant="outline" size="xs" onClick={() => setSelectedEntity(null)}>
            &lt; Back to {title}
          </Button>

          {panel({ entity: selectedEntity })}
        </div>
      ) : (
        <>
          {headerPanel}
          <ul>
            {list.map((entity) => (
              <li
                className="py-2 px-2 border-y-2 border-x border-gold flex justify-between hover:bg-gold/40 my-1"
                key={entity.id}
                onClick={() => setSelectedEntity(entity)}
              >
                {entity.name} <ArrowRight className="w-2 fill-current" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
