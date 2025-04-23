import { useStructureUpgrade } from "@/features/upgrade-structure";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { ContractAddress } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { ArrowRight, Castle, Sparkles } from "lucide-react";
import { useState } from "react";
import { UpgradeDrawer } from "./upgrade-drawer";

interface UpgradeCastleProps {
  realmEntityId: number;
}

export const UpgradeCastle = ({ realmEntityId }: UpgradeCastleProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dojo = useDojo();
  const { currentLevel, nextLevel, canUpgrade, upgradeProgress, currentLevelName, nextLevelName } =
    useStructureUpgrade(realmEntityId);

  // Check ownership
  const isOwner = ContractAddress(dojo.account.account.address);
  if (!isOwner) return null;

  return (
    <>
      <Card
        className={`relative overflow-hidden ${canUpgrade ? "bg-gradient-to-br from-amber-500/20 via-card/50 to-emerald-500/20 backdrop-blur-sm" : "bg-card"}`}
      >
        {canUpgrade && (
          <>
            <div className="absolute right-0 top-0 h-32 w-32 animate-pulse bg-green-500/50 blur-3xl" />
            <div className="absolute left-0 top-0 h-32 w-32 animate-pulse bg-amber-500/50 blur-3xl" />
          </>
        )}

        <CardHeader className="relative pb-0">
          <div className="flex items-center gap-2">
            {canUpgrade ? (
              <>
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium uppercase tracking-wider text-amber-500">
                  Castle Upgrade Available
                </span>
              </>
            ) : (
              <>
                <Castle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Castle Upgrade
                </span>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="relative flex items-center justify-between gap-4 pt-3">
          <div className="flex flex-1 flex-col gap-3">
            <h3 className="flex flex-col text-xl font-bold">
              {nextLevel !== null ? (
                <>
                  <span className={canUpgrade ? "text-success" : "text-muted-foreground"}>
                    {canUpgrade ? "Ready to Upgrade!" : "Need More Resources"}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {canUpgrade ? (
                      <>
                        {currentLevelName}
                        <ArrowRight className="h-4 w-4" />
                        {nextLevelName}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-lg">Progress: {upgradeProgress}%</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{currentLevelName} (Max Level)</span>
              )}
            </h3>

            <Button
              onClick={() => setIsDrawerOpen(true)}
              className={
                canUpgrade
                  ? "w-fit bg-gradient-to-r from-amber-500 to-emerald-500 text-white shadow-lg hover:from-amber-600 hover:to-emerald-600"
                  : "w-fit"
              }
              variant={canUpgrade ? "default" : "outline"}
              size="lg"
            >
              <Castle className="mr-2 h-4 w-4" />
              {nextLevel !== null
                ? canUpgrade
                  ? `Upgrade to Level ${nextLevel}`
                  : "Show Requirements"
                : "View Castle Details"}
            </Button>
          </div>

          <div className="relative h-28 w-28 shrink-0">
            {canUpgrade && <div className="absolute inset-0 animate-pulse rounded-full bg-success/20 blur-xl" />}
            <img
              src={`/images/castles/castle-${currentLevel}.png`}
              alt="Castle"
              className="relative h-full w-full object-contain drop-shadow-xl"
            />
          </div>
        </CardContent>
      </Card>

      <UpgradeDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} realmEntityId={realmEntityId} />
    </>
  );
};
