import { DUMMY_HYPERSTRUCTURE_ENTITY_ID } from "@/three/scenes/constants";
import Button from "@/ui/elements/Button";
import { ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import React, { useEffect, useState } from "react";

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
  entityHeader: (props: { id: any }) => React.ReactElement | null;
  entityContent?: (props: { id: any }) => React.ReactElement | null;
  chunkSize?: number;
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
  entityHeader,
  entityContent,
  chunkSize,
  questing,
  className,
  extraBackButtonContent,
  filterEntityIds,
}: EntityListProps) => {
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayCount, setDisplayCount] = useState(chunkSize || 20);

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

  const displayedItems = filteredList.slice(0, displayCount);
  const hasMore = displayCount < filteredList.length;

  const loadMore = () => {
    setDisplayCount((prev) => Math.min(prev + 20, filteredList.length));
  };

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
              setDisplayCount(chunkSize || 20); // Reset display count when search changes
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            className="w-full p-2 mb-2 bg-gold/10 border border-gold/20 rounded text-gold placeholder-gold/50 focus:outline-none focus:border-gold/40"
          />
          <div>
            <ul>
              {displayedItems.map((entity) => (
                <li
                  className={clsx("py-2 px-2 bg-gold/20 hover:bg-crimson/40 my-1 rounded border border-gold/10", {
                    "animate-pulse pointer-events-none":
                      questing || entity.id === Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
                  })}
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                >
                  <div className="flex flex-col space-y-2">
                    {entityHeader(entity.id)}

                    {entity.id !== Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID) && (
                      <div className="border border-gold/20 bg-gold/10 rounded p-2">
                        {entityContent && entityContent(entity.id)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="text-center py-4">
                <Button onClick={loadMore} variant="default" size="xs">
                  Load More
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
