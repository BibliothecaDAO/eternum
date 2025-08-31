import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { RealmInfo } from "@bibliothecadao/types";
import { ReactNode, useState } from "react";

interface SelectStructureDrawerProps {
  structures: RealmInfo[];
  selectedStructureId: number;
  onSelectStructure: (structureId: number) => void;
  children: ReactNode;
}

export const SelectStructureDrawer = ({
  structures,
  selectedStructureId,
  onSelectStructure,
  children,
}: SelectStructureDrawerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (structureId: number) => {
    onSelectStructure(structureId);
    setOpen(false);
  };

  const isBlitz = getIsBlitz();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Select Structure</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 space-y-2">
          {structures.map((structure) => (
            <Button
              key={structure.entityId}
              variant={structure.entityId === selectedStructureId ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleSelect(structure.entityId)}
            >
              {getStructureName(structure.structure, isBlitz).name}
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
