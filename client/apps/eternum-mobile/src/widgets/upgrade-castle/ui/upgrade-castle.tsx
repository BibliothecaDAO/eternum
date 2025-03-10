import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { getLevelName } from "@bibliothecadao/eternum";
import { ArrowRight, Castle, Sparkles } from "lucide-react";
import { useState } from "react";
import { UpgradeDrawer } from "./upgrade-drawer";

interface UpgradeCastleProps {
  castleLevel: number;
  onUpgrade: () => Promise<void>;
}

export const UpgradeCastle = ({ castleLevel, onUpgrade }: UpgradeCastleProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-card/50 to-emerald-500/20 backdrop-blur-sm">
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 h-32 w-32 animate-pulse bg-green-500/50 blur-3xl" />
        <div className="absolute left-0 top-0 h-32 w-32 animate-pulse bg-amber-500/50 blur-3xl" />

        <CardHeader className="relative pb-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium uppercase tracking-wider text-amber-500">
              Castle Upgrade Available
            </span>
          </div>
        </CardHeader>

        <CardContent className="relative flex items-center justify-between gap-4 pt-3">
          <div className="flex flex-1 flex-col gap-3">
            <h3 className="flex flex-col text-xl font-bold">
              <span className="text-success">Ready to Upgrade!</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                to {getLevelName(castleLevel)}
                <ArrowRight className="h-4 w-4" />
                Level {castleLevel}
              </span>
            </h3>

            <Button
              onClick={() => setIsDrawerOpen(true)}
              className="w-fit bg-gradient-to-r from-amber-500 to-emerald-500 text-white shadow-lg hover:from-amber-600 hover:to-emerald-600"
              size="lg"
            >
              <Castle className="mr-2 h-4 w-4" />
              Upgrade Now
            </Button>
          </div>

          <div className="relative h-28 w-28 shrink-0">
            <div className="absolute inset-0 animate-pulse rounded-full bg-success/20 blur-xl" />
            <img
              src={`/images/castles/castle-0.png`}
              alt="Castle"
              className="relative h-full w-full object-contain drop-shadow-xl"
            />
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
