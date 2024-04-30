import { useCaravan } from "@/hooks/helpers/useCaravans";
import { Entity } from "./Entity";

export const EntitiesOnPositionList = ({ position }: any) => {
  // only mine = true
  return (
    <div>
      {/* // todo: get entities that have inventory instead */}
      {/* {[].map((entity) => {
        return <Entity key={entity.caravanId} entity={entity} />;
      })} */}
    </div>
  );
};
