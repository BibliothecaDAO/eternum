import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardTitle } from "@/shared/ui/card";
import { PackageCheck } from "lucide-react";

interface ArrivedDonkeysProps {
  onClaim: () => void;
  readyCount?: number;
  pendingCount?: number;
}

export const ArrivedDonkeys = ({ onClaim, readyCount = 0, pendingCount = 0 }: ArrivedDonkeysProps) => {
  const totalCount = readyCount + pendingCount;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className={cn(readyCount > 0 && "bg-green-500/10")}>
      <CardContent className="space-y-3 p-4 h-full">
        <CardTitle className={cn("text-sm flex w-full items-center gap-2", readyCount > 0 && "text-green-500")}>
          <PackageCheck className="w-4 h-4" />
          Arrivals
        </CardTitle>
        <div className="text-xs space-y-1">
          <div>
            <span className="font-bold">{readyCount}</span> ready to claim
            {pendingCount > 0 && <span className="text-muted-foreground"> • {pendingCount} pending</span>}
          </div>
          {readyCount > 0 && (
            <div>
              <span className="font-bold">Claim your resources.</span>
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full font-semibold"
          onClick={onClaim}
          disabled={readyCount === 0}
        >
          {readyCount > 0 ? "Claim Resources" : "View Arrivals"}
          <PackageCheck className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};
