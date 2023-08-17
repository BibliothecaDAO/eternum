import { findResourceById } from "../../../constants/resources";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { currencyFormat } from "../../../utils/utils";
import { ResourceInterface } from "../../../hooks/graphql/useGraphQLQueries";

export const SmallResource = ({
  resourceId,
  resource,
}: {
  resourceId: number;
  resource: ResourceInterface | undefined;
}) => {
  return (
    <div className="flex items-center">
      <ResourceIcon
        resource={findResourceById(resourceId)?.trait || ""}
        size="xs"
        className="mr-1"
      />
      <div className="text-xxs">{currencyFormat(resource?.amount || 0)}</div>
    </div>
  );
};
