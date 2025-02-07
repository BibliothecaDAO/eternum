import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { getLevelName } from "@bibliothecadao/eternum";
import { useState } from "react";
import { UpgradeDrawer } from "./upgrade-drawer";

interface UpgradeCastleProps {
  castleLevel: number;
  onUpgrade: () => void;
}

export const UpgradeCastle = ({ castleLevel, onUpgrade }: UpgradeCastleProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-success">
              Ready to upgrade to {getLevelName(castleLevel)} (Level {castleLevel})!
            </h3>
            <Button onClick={() => setIsDrawerOpen(true)} className="w-fit">
              Upgrade
            </Button>
          </div>
          <div className="h-24 w-24">
            <img src={`/images/castles/castle-0.png`} alt="Castle" className="h-full w-full object-contain" />
          </div>
        </CardContent>
      </Card>

      <UpgradeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        castleLevel={castleLevel}
        onUpgrade={onUpgrade}
      />
    </>
  );
};
