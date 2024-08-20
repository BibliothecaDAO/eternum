import { Entity } from "../entities/Entity";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { HintSection } from "../hints/HintModal";
import { ID } from "@bibliothecadao/eternum";

export const AllResourceArrivals = ({ entityIds }: { entityIds: ID[] }) => {
  return (
    <div className="p-2 flex flex-col space-y-1 overflow-y-auto">
      <Headline>
        {" "}
        <div className="flex gap-2">
          <div className="self-center">Transfers</div>
          <HintModalButton section={HintSection.Transfers} />
        </div>
      </Headline>
      {!entityIds.length && <div className="text-center">No resource arrivals yet.</div>}
      {entityIds.map((entityId) => {
        return <Entity key={entityId} entityId={entityId} />;
      })}
    </div>
  );
};
