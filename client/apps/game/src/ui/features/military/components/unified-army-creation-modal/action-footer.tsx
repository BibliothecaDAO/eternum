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
    <div className="p-4 rounded-xl bg-gradient-to-br from-brown/10 to-brown/5 border border-brown/30">
      <Button
        variant="gold"
        onClick={onSubmit}
        disabled={isDisabled}
        isLoading={isLoading}
        className={clsx(
          "w-full py-5 text-lg font-bold transition-all duration-300 rounded-xl",
          "bg-gradient-to-br from-gold to-gold/80 hover:from-gold/90 hover:to-gold/70",
          "shadow-xl hover:shadow-2xl hover:shadow-gold/40",
          "border-2 border-gold/60 hover:border-gold/80",
          "transform hover:scale-[1.02] hover:-translate-y-0.5",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg",
        )}
      >
        <div className="flex items-center justify-center gap-3">
          {armyType ? <Users className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          <span className="drop-shadow-sm">{label}</span>
        </div>
      </Button>
    </div>
  );
};
