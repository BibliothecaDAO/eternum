import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { DialogShell } from "@/ui/design-system/molecules/dialog-shell";

export const NoAccountModal = () => {
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setModal = useUIStore((state) => state.setModal);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const handleHomeClick = () => {
    setModal(null, false);
    setShowBlankOverlay(true);
  };

  return (
    <DialogShell title="Account Required" size="md" onClose={() => toggleModal(null)}>
      <div className="prose prose-pink max-w-none">
        <p className="text-center mb-8">
          Sign in from the landing page so your gameplay account can be prepared before entering the game.
        </p>
        <div className="flex justify-center">
          <Button
            onClick={handleHomeClick}
            className="!bg-[#FCB843] !text-black border-none hover:!bg-[#FCB843]/80"
            variant="default"
          >
            Return to login
          </Button>
        </div>
      </div>
    </DialogShell>
  );
};
