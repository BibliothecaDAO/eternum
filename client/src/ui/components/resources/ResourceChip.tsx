import { findResourceById, getIconResourceId } from "@bibliothecadao/eternum";
import { useDojo } from "../../../hooks/context/DojoContext";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat } from "../../utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { Entity } from "@dojoengine/recs";

export const ResourceChip = ({
  isLabor = false,
  resourceId,
  balance,
  rate,
}: {
  isLabor?: boolean;
  resourceId: number;
  balance: number;

  rate?: string;
}) => {
  return (
    <div className={`flex relative group items-center text-sm border rounded px-2 p-1`}>
      <ResourceIcon
        isLabor={isLabor}
        withTooltip={false}
        resource={findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}
        size="md"
        className="mr-1"
      />
      <div className="flex space-x-3 items-center justify-center">
        <div className="font-bold">{findResourceById(resourceId)?.trait}</div>
        <div>{currencyFormat(balance ? Number(balance) : 0, 2)}</div>
        {rate && (
          <div className={Number(rate) < 0 ? "text-red" : "text-green"}>
            {parseFloat(rate) < 0 ? "" : "+"}
            {currencyFormat(rate, 2)}
          </div>
        )}
      </div>
    </div>
  );
};
