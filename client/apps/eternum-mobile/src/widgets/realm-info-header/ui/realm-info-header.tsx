import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ProgressCircle } from "@/shared/ui/progress-circle";
import { RealmLevelNames, RealmLevels } from "@bibliothecadao/eternum";
import { Copy } from "lucide-react";

interface RealmInfoHeaderProps {
  realmName: string;
  realmLevel: RealmLevels;
  realmProgress: number;
  balance: number;
  coordinates: {
    x: number;
    y: number;
  };
  realmNumber: number;
}

export const RealmInfoHeader = ({
  realmName,
  realmLevel,
  realmProgress,
  balance,
  coordinates,
  realmNumber,
}: RealmInfoHeaderProps) => {
  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${coordinates.x},${coordinates.y}`);
  };

  return (
    <div className="space-y-2">
      {/* First row */}
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="font-mono">
          {balance.toLocaleString()} $LORDS
        </Badge>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {coordinates.x},{coordinates.y}
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={handleCopyCoords}>
              <Copy className="h-4 w-4" />
            </Button>
          </Badge>
        </div>

        <span className="text-sm text-muted-foreground">#{realmNumber}</span>
      </div>

      {/* Second row */}
      <div className="flex items-center space-x-2">
        <div>
          <h1 className="text-5xl font-bold font-bokor">
            {realmName}{" "}
            <span className="text-3xl font-normal text-muted-foreground">
              {RealmLevelNames[RealmLevels[realmLevel]]}
            </span>
          </h1>
        </div>
        <ProgressCircle progress={realmProgress} size="md">
          {realmLevel + 1}
        </ProgressCircle>
      </div>
    </div>
  );
};
