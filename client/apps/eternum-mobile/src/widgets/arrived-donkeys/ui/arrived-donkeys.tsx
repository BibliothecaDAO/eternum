import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardTitle } from "@/shared/ui/card";
import { PackageCheck } from "lucide-react";

interface ArrivedDonkeysProps {
  entityId: number;
  onClaim: () => void;
}

// Dummy data generator for demo purposes
const generateDummyData = () => {
  return {
    donkeysCount: Math.floor(Math.random() * 5) + 1,
  };
};

// @ts-ignore
export const ArrivedDonkeys = ({ entityId, onClaim }: ArrivedDonkeysProps) => {
  const { donkeysCount } = generateDummyData();

  return (
    <Card>
      <CardContent className="space-y-3 p-4 h-full">
        <CardTitle className={cn("text-sm flex w-full items-center gap-2")}>
          <PackageCheck className="w-4 h-4" />
          Arrivals
        </CardTitle>
        <div className="text-xs space-y-1">
          <div>
            <span className="font-bold">{donkeysCount}</span> Donkeys have arrived
          </div>
          <div>
            <span className="font-bold">Claim your resources.</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="w-full font-semibold" onClick={onClaim}>
          Show Arrivals
          <PackageCheck className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};
