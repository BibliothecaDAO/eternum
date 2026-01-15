import Button from "@/ui/design-system/atoms/button";
import clsx from "clsx";
import { Shield, Users } from "lucide-react";

interface ActionFooterProps {
  armyType: boolean;
  label: string;
  isLoading: boolean;
  isDisabled: boolean;
  onSubmit: () => void;
}

export const ActionFooter = ({ armyType, label, isLoading, isDisabled, onSubmit }: ActionFooterProps) => {
  return (
    <div className="p-1.5 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-gold/20">
      <Button
        variant="gold"
        onClick={onSubmit}
        disabled={isDisabled}
        isLoading={isLoading}
        className={clsx(
          "w-full py-3 text-sm font-extrabold transition-all duration-200 rounded-lg",
          "bg-gradient-to-br from-gold to-gold/80 hover:from-gold/90 hover:to-gold/70",
          "shadow-xl hover:shadow-xl hover:shadow-gold/50",
          "border-2 border-gold/60 hover:border-gold/80",
          "transform hover:scale-[1.02]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md",
        )}
      >
        <div className="flex items-center justify-center gap-2">
          {armyType ? <Users className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          <span className="drop-shadow-sm">{label}</span>
        </div>
      </Button>
    </div>
  );
};
