import React, { useState } from "react";

import Button from "@/ui/elements/Button";

interface EntityListProps {
  title: string;
  panel: (props: { entity: any }) => React.ReactElement;
  list: any[];
}

export const EntityList = ({ title, panel, list }: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState(null);

  const handleBankClick = (entity: any) => {
    setSelectedEntity(entity);
  };

  const handleBreadcrumbClick = () => {
    setSelectedEntity(null);
  };

  return (
    <div className="p-2">
      {selectedEntity ? (
        <div>
          <Button className="mb-3" variant="outline" size="xs" onClick={handleBreadcrumbClick}>
            &lt; Back to {title}
          </Button>

          {panel({ entity: selectedEntity })}
        </div>
      ) : (
        <>
          <ul>
            {list.map((entity) => (
              <li
                className="text-xl py-2 border-b flex justify-between hover:bg-black"
                key={entity.id}
                onClick={() => handleBankClick(entity)}
              >
                {entity.name} <span>see</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
