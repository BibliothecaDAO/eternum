import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { Structure } from "@bibliothecadao/eternum";
import { ReactNode, useState } from "react";

interface SelectStructureDrawerProps {
  structures: Structure[];
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
              {structure.name}
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
