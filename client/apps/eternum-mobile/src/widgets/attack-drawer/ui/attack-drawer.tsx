import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { getIsBlitz } from "@bibliothecadao/eternum";
import { useState } from "react";
import { AttackDrawerProps } from "../model/types";
import { CombatContainer } from "./combat-container";
import { RaidContainer } from "./raid-container";

enum AttackType {
  Combat,
  Raid,
}

export const AttackDrawer = ({ open, onOpenChange, attackerEntityId, targetHex }: AttackDrawerProps) => {
  const [attackType, setAttackType] = useState<AttackType>(AttackType.Combat);

  const getDrawerTitle = () => {
    return `Attack (${targetHex.x}, ${targetHex.y})`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{getDrawerTitle()}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          {!getIsBlitz() ? (
            <Tabs
              value={attackType === AttackType.Combat ? "combat" : "raid"}
              onValueChange={(value) => setAttackType(value === "combat" ? AttackType.Combat : AttackType.Raid)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="combat" className="flex items-center gap-2">
                  <span>⚔️</span>
                  <span>Combat</span>
                </TabsTrigger>
                <TabsTrigger value="raid" className="flex items-center gap-2">
                  <span>💰</span>
                  <span>Raid</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="combat" className="mt-0">
                <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
              </TabsContent>

              <TabsContent value="raid" className="mt-0">
                <RaidContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
              </TabsContent>
            </Tabs>
          ) : (
            <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
