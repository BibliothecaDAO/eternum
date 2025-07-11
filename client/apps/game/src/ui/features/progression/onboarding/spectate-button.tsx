import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import Button from "@/ui/design-system/atoms/button";

export const SpectateButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button className="w-full" onClick={onClick} size="lg">
      <div className="flex items-center justify-start w-full">
        <Eye className="w-6 fill-current mr-2" /> <div className="flex-grow text-center">Spectate</div>
      </div>
    </Button>
  );
};
