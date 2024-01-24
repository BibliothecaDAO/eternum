import { Guilds, resourcesByGuild } from "@bibliothecadao/eternum";
import { useResources } from "../../../../../hooks/helpers/useResources";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { SelectableLaborResource } from "./SelectableLaborResource";

type SelectLaborResourceComponentProps = {
  guild: number;
  selectedLaborResource: number | undefined;
  setSelectedLaborResource: (resourceId: number) => void;
};

export const SelectLaborResourceComponent = ({
  guild,
  selectedLaborResource,
  setSelectedLaborResource,
}: SelectLaborResourceComponentProps) => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { getBalance } = useResources();

  const resources = resourcesByGuild[Guilds[guild]];

  const resourceBalance = resources.map((resourceId) => {
    return {
      resourceId,
      amount: getBalance(realmEntityId, resourceId + 28)?.balance || 0,
    };
  });

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-1">
      {resourceBalance.map((resource) => {
        return (
          <SelectableLaborResource
            key={resource.resourceId}
            resourceId={resource.resourceId}
            selected={selectedLaborResource === resource.resourceId}
            amount={resource.amount}
            onClick={() => {
              setSelectedLaborResource(resource.resourceId);
            }}
          />
        );
      })}
    </div>
  );
};
