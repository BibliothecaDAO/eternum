import { Guild, resourcesByGuild } from "@bibliothecadao/eternum";
import { useResources } from "../../../../../hooks/helpers/useResources";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { SelectableLaborResource } from "./SelectableLaborResource";

type SelectLaborResourceComponentProps = {
  guild: Guild;
  selectedLaborResource: number | undefined;
  setSelectedLaborResource: (resourceId: number) => void;
};

export const SelectLaborResourceComponent = ({ guild }: SelectLaborResourceComponentProps) => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { getBalance } = useResources();

  const resources = resourcesByGuild[guild];

  const resourceBalance = resources.map((resourceId) => {
    return {
      resourceId,
      amount: getBalance(realmEntityId, resourceId + 28)?.balance || 0,
    };
  });

  return resourceBalance.map((resource) => {
    return (
      <SelectableLaborResource key={resource.resourceId} resourceId={resource.resourceId} amount={resource.amount} />
    );
  });
};
