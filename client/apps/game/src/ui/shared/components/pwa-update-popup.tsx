import Button from "@/ui/elements/button";

interface PWAUpdatePopupProps {
  onUpdate: () => void;
}

export const PWAUpdatePopup = ({ onUpdate }: PWAUpdatePopupProps) => {
  return (
    <div className="fixed bottom-4 right-4 bg-brown border border-gold/10 p-4 rounded-xl shadow-lg z-50">
      <div className="flex flex-col gap-2">
        <div className="text-gold font-bold">New Update Available</div>
        <div className="text-sm text-gold/70">A new version of the game is available.</div>
        <div className="flex gap-2">
          <Button onClick={onUpdate} variant="primary">
            Update Now
          </Button>
        </div>
      </div>
    </div>
  );
};
