import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import Button from "@/ui/design-system/atoms/button";

export const SpectateButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button className="w-full" onClick={onClick}>
      <div className="flex items-center justify-center">
        <Eye className="w-5 h-5 mr-2 fill-brown" />
        <span>Spectate</span>
      </div>
    </Button>
  );
};
