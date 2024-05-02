import React, { useState } from "react";
import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import Button from "@/ui/elements/Button";

interface EntityListProps {
  title: string;
  headerPanel?: React.ReactElement;
  panel: (props: { entity: any; previous?: undefined | any[] }) => React.ReactElement;
  list: any[];
  previous?: any[];
}

export const EntityList = ({ title, panel, list, headerPanel }: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const handleBankClick = (entity: any) => {
    setSelectedEntity(entity);
  };

  const handleBreadcrumbClick = () => {
    setSelectedEntity(null);
  };

  return (
    <div>
      {selectedEntity ? (
        <div className="p-2">
          <Button className="mb-3" variant="outline" size="xs" onClick={handleBreadcrumbClick}>
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
                className="py-2 px-2 border-b border-gold/40 flex justify-between hover:bg-brown"
                key={entity.id}
                onClick={() => handleBankClick(entity)}
              >
                {entity.name} <ArrowRight className="w-2" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
