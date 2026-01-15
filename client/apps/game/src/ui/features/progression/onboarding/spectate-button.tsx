import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import Button from "@/ui/design-system/atoms/button";

interface SpectateButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export const SpectateButton = ({ onClick, className, disabled = false, label }: SpectateButtonProps) => {
  if (disabled) {
    return null;
  }

  const text = label ?? "Spectate";

  return (
    <Button className={`w-full${className ? " " + className : ""}`} onClick={onClick} forceUppercase={false}>
      <div className="flex items-center justify-center">
        <Eye className="w-5 h-5 mr-2 fill-brown" />
        <span>{text}</span>
      </div>
    </Button>
  );
};
