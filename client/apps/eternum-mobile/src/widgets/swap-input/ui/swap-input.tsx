import { useResourceBalances } from "@/features/resource-balances/model/use-resource-balances";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { NumericInput } from "@/shared/ui/numeric-input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ResourceSelectDrawer } from "@/shared/ui/resource-select-drawer";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { ID, resources } from "@bibliothecadao/types";

interface SwapInputProps {
  direction: "buy" | "sell";
  resourceId: number;
  amount: number;
  onAmountChange?: (amount: number) => void;
  onResourceChange?: (resourceId: number) => void;
  entityId: ID;
}

export const SwapInput = ({
  direction,
  resourceId,
  amount,
  onAmountChange,
  onResourceChange,
  entityId,
}: SwapInputProps) => {
  const { resourceAmounts } = useResourceBalances(entityId);
  const balance = divideByPrecision(Number(resourceAmounts.find((r) => r.id === resourceId)?.amount || 0));

  const handlePercentageClick = (percentage: number) => {
    onAmountChange?.(Math.floor((balance * percentage) / 100));
  };

  const selectedResource = resources.find((r) => r.id === resourceId);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Top section */}
        <div className="flex justify-between items-center">
          <div className="text-lg font-medium capitalize">{direction}</div>
          <ResourceSelectDrawer
            onResourceSelect={(id: number) => onResourceChange?.(id)}
            showBalance={true}
            entityId={entityId}
          >
            <Button variant="outline" className="w-[200px] justify-between">
              <div className="flex items-center gap-2">
                {selectedResource && <ResourceIcon resourceId={selectedResource.id} size={20} />}
                <span>{selectedResource?.trait}</span>
              </div>
            </Button>
          </ResourceSelectDrawer>
        </div>

        {/* Middle section - Amount input */}
        <NumericInput
          inputClassName="text-2xl h-16 text-center"
          value={amount}
          onChange={onAmountChange}
          description={`${selectedResource?.trait}`}
        />

        {/* Bottom section */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Balance: {balance} {selectedResource?.trait}
          </div>
          <div className="flex gap-1">
            {[10, 25, 50, 100].map((percentage) => (
              <Button key={percentage} variant="secondary" size="sm" onClick={() => handlePercentageClick(percentage)}>
                {percentage === 100 ? "All" : `${percentage}%`}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
