import { Guilds, resourcesByGuild } from "@bibliothecadao/eternum";
import { useResources } from "../../../../../../hooks/helpers/useResources";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
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

  const resources = Guilds[guild - 1] ? resourcesByGuild[Guilds[guild - 1]] : undefined;

  const resourceBalance = resources
    ? resources.map((resourceId) => {
        return {
          resourceId,
          amount: getBalance(realmEntityId, resourceId + 28)?.balance || 0,
        };
      })
    : undefined;

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-1">
      {resourceBalance &&
        resourceBalance.map((resource) => {
          return (
            <SelectableLaborResource
              key={resource.resourceId}
              guild={guild}
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
