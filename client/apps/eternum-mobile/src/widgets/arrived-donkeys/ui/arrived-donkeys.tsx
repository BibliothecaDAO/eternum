import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/shared/ui/card";
import PackageCheck from "lucide-react/dist/esm/icons/package-check";

interface ArrivedDonkeysProps {
  onClaim: () => void;
  readyCount?: number;
  pendingCount?: number;
}

export const ArrivedDonkeys = ({ onClaim, readyCount = 0, pendingCount = 0 }: ArrivedDonkeysProps) => {
  return (
    <Card className={cn(readyCount > 0 && "bg-green-500/10", "flex flex-col justify-between")}>
      <CardContent className="space-y-3 p-4">
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
      </CardContent>
      <CardFooter className="p-4">
        <Button
          variant="secondary"
          size="sm"
          className="w-full font-semibold"
          onClick={onClaim}
          disabled={readyCount === 0 && pendingCount === 0}
        >
          {readyCount > 0
            ? "Claim Resources"
            : readyCount === 0 && pendingCount === 0
              ? "No arrivals"
              : "View Arrivals"}
          <PackageCheck className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
};
