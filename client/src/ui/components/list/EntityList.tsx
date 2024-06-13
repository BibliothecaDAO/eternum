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
  entityContent?: (props: { id: any }) => React.ReactElement | null;
}

export const EntityList = ({ title, panel, list, headerPanel, current, entityContent }: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  useEffect(() => {
    const entity = list.find((entity) => entity.entity_id === current);
    if (entity) setSelectedEntity(entity || null);
  }, [current]);

  return (
    <div className="">
      {selectedEntity ? (
        <div className="p-2">
          <Button className="mb-3" variant="default" size="xs" onClick={() => setSelectedEntity(null)}>
            &lt; Back to {title}
          </Button>

          {panel({ entity: list.find((entity) => entity.entity_id === selectedEntity.entity_id) })}
        </div>
      ) : (
        <div className="p-2">
          {headerPanel}
          <ul>
            {list.map((entity, index) => (
              <li
                className="py-2 px-2 bg-gold/20 clip-angled-sm flex justify-between hover:bg-crimson/40 my-1 rounded border border-gold/10"
                key={index}
                onClick={() => setSelectedEntity(entity)}
              >
                {entity.name}
                {entityContent && entityContent(entity.id)} {/* Dynamic entity icon */}
                <ArrowRight className="w-2 fill-current" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
