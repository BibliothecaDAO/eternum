import { BRIDGE_FEE_DENOMINATOR, ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum"

import { Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { ResourceIcon } from "../ui/elements/resource-icon";

interface FeesCollapsibleProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  setResourceFees: (
    totalFees: {
      id: string;
      velordsFee: string;
      seasonPoolFee: string;
      clientFee: string;
      bankFee: string;
      totalFee: string;
    }[],
  ) => void;
  resourceSelections: { [key: string]: number };
  type: "deposit" | "withdrawal";
}

function formatFee(fee: number) {
  return fee.toFixed(2);
}

const calculateBridgeFee = (percent: number, amount: string) => {
  return (percent * Number(amount)) / BRIDGE_FEE_DENOMINATOR;
};

export const BridgeFees = ({
  isOpen,
  onOpenChange,
  resourceSelections,
  type,
  setResourceFees,
}: FeesCollapsibleProps) => {
  const bridgeConfig = configManager.getResourceBridgeFeeSplitConfig();

  const calculateBridgeFeeDisplayPercent = (percent: number) => {
    return (percent * 100) / BRIDGE_FEE_DENOMINATOR;
  };

  const feesForAllResources = useMemo(() => {
    const resourceFees = Object.entries(resourceSelections).map(([id, amount]) => {
      const velordsFee = calculateBridgeFee(
        type === "deposit" ? bridgeConfig.velords_fee_on_dpt_percent : bridgeConfig.velords_fee_on_wtdr_percent,
        amount.toString(),
      );
      const seasonPoolFee = calculateBridgeFee(
        type === "deposit" ? bridgeConfig.season_pool_fee_on_dpt_percent : bridgeConfig.season_pool_fee_on_wtdr_percent,
        amount.toString(),
      );
      const clientFee = calculateBridgeFee(
        type === "deposit" ? bridgeConfig.client_fee_on_dpt_percent : bridgeConfig.client_fee_on_wtdr_percent,
        amount.toString(),
      );
      const bankFee = calculateBridgeFee(
        type === "deposit" ? bridgeConfig.realm_fee_dpt_percent : bridgeConfig.realm_fee_wtdr_percent,
        amount.toString(),
      );

      return {
        id,
        velordsFee: formatFee(velordsFee),
        seasonPoolFee: formatFee(seasonPoolFee),
        clientFee: formatFee(clientFee),
        bankFee: formatFee(bankFee),
        totalFee: formatFee(velordsFee + seasonPoolFee + clientFee + bankFee),
      };
    });
    setResourceFees(resourceFees);
    return resourceFees;
  }, [resourceSelections]);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button className="w-full flex justify-between font-bold px-0 border-y rounded-none" variant={"ghost"}>
          <div className="flex items-center">
            {isOpen ? <Minus className="mr-4" /> : <Plus className="mr-4" />}
            Total Transfer Fee
          </div>
          <div>{formatFee(feesForAllResources.reduce((sum, fees) => sum + Number(fees.totalFee), 0))} units</div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col ">
        {feesForAllResources.map((fees) => {
          const resourceName = ResourcesIds[fees.id as keyof typeof ResourcesIds].toString();
          return (
            <div key={fees.id} className="flex flex-col gap-2 py-4 border-b border-gold/15">
              <div className="font-semibold text-sm">
                <div className="flex justify-between w-full">
                  <span>{resourceName} </span>
                  <span className="flex items-center gap-2">
                    <span>Total:</span> <ResourceIcon resource={resourceName} size="md" />
                    {fees.totalFee}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <div>Bank Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.realm_fee_dpt_percent)}%)</div>
                <div>{fees.bankFee}</div>
              </div>
              <div className="flex justify-between text-xs">
                <div>Velords Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.velords_fee_on_dpt_percent)}%)</div>
                <div>{fees.velordsFee}</div>
              </div>
              <div className="flex justify-between text-xs">
                <div>
                  Season Pool Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.season_pool_fee_on_dpt_percent)}%)
                </div>
                <div>{fees.seasonPoolFee}</div>
              </div>
              <div className="flex justify-between text-xs">
                <div>Client Fees ({calculateBridgeFeeDisplayPercent(bridgeConfig.client_fee_on_dpt_percent)}%)</div>
                <div>{fees.clientFee}</div>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};
