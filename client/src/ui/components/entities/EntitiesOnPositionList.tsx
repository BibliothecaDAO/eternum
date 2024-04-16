import { useCaravan } from "@/hooks/helpers/useCaravans";
import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "@/hooks/context/DojoContext";
import { Entity } from "./Entity";

export const EntitiesOnPositionList = ({ position }: any) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const { useGetPositionCaravans } = useCaravan();

  // const position = getComponentValue(Position, getEntityIdFromKeys([entity.id])) || { x: 0, y: 0 };
  const { caravans } = useGetPositionCaravans(position.x, position.y);

  return (
    <div>
      {caravans.map((entity) => {
        return <Entity key={entity.caravanId} entity={entity} />;
      })}
    </div>
  );
};
