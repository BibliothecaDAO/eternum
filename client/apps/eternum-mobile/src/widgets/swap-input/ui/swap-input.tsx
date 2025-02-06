import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { resources } from "@bibliothecadao/eternum";

interface SwapInputProps {
  direction: "buy" | "sell";
  resourceId: number;
  amount: number;
  onAmountChange?: (amount: number) => void;
  onResourceChange?: (resourceId: number) => void;
}

export const SwapInput = ({ direction, resourceId, amount, onAmountChange, onResourceChange }: SwapInputProps) => {
  // Dummy balance for demonstration
  const balance = Math.floor(Math.random() * 1000);

  const handlePercentageClick = (percentage: number) => {
    onAmountChange?.(Math.floor((balance * percentage) / 100));
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Top section */}
        <div className="flex justify-between items-center">
          <div className="text-lg font-medium capitalize">{direction}</div>
          <Select value={String(resourceId)} onValueChange={(value) => onResourceChange?.(Number(value))}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resources.map((resource) => (
                <SelectItem key={resource.id} value={String(resource.id)}>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={resource.id} size={20} />
                    <div className="flex flex-col">
                      <span className="font-medium">{resource.trait}</span>
                      <span className="text-xs text-muted-foreground">Balance: {balance}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Middle section - Amount input */}
        <Input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange?.(Number(e.target.value))}
          className="text-2xl h-16 text-center"
          placeholder="0.0"
        />

        {/* Bottom section */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Balance: {balance} {resources.find((r) => r.id === resourceId)?.trait}
          </div>
          <div className="flex gap-1">
            {[10, 25, 50, 100].map((percentage) => (
              <Button key={percentage} variant="outline" size="sm" onClick={() => handlePercentageClick(percentage)}>
                {percentage === 100 ? "All" : `${percentage}%`}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
