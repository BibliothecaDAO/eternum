import { useCaravan } from "@/hooks/helpers/useCaravans";
import { Entity } from "./Entity";

export const EntitiesOnPositionList = ({ position }: any) => {
  const { useGetPositionCaravans } = useCaravan();

  // only mine = true
  const { caravans } = useGetPositionCaravans(position.x, position.y, true);

  return (
    <div>
      {caravans.map((entity) => {
        return <Entity key={entity.caravanId} entity={entity} />;
      })}
    </div>
  );
};
