import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { useStore } from "@/shared/store";
import { Suspense } from "react";
import { TransferContainer } from "./transfer-container";
import { Loading } from "@/shared/ui/loading";

export const TransferDrawer = () => {
  const { 
    isTransferDrawerOpen, 
    transferDrawerData, 
    setTransferDrawer 
  } = useStore((state) => ({
    isTransferDrawerOpen: state.isTransferDrawerOpen,
    transferDrawerData: state.transferDrawerData,
    setTransferDrawer: state.setTransferDrawer,
  }));

  const handleOpenChange = (open: boolean) => {
    setTransferDrawer(open);
  };

  if (!transferDrawerData.selected || !transferDrawerData.target) {
    return null;
  }

  return (
    <Drawer open={isTransferDrawerOpen} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bokor text-center">
            Transfer Resources & Troops
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto max-h-[80vh]">
          <Suspense fallback={<Loading />}>
            <TransferContainer 
              selected={transferDrawerData.selected}
              target={transferDrawerData.target}
              allowBothDirections={transferDrawerData.allowBothDirections}
            />
          </Suspense>
        </div>
      </DrawerContent>
    </Drawer>
  );
};