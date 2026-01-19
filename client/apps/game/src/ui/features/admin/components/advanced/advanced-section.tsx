import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

interface AdvancedSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export const AdvancedSection = ({ isExpanded, onToggle, children }: AdvancedSectionProps) => {
  return (
    <div className="mt-12 pt-8 border-t border-gold/20">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-semibold text-gold/70 hover:text-gold transition-colors"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Advanced / Developer Options
      </button>

      {isExpanded && (
        <div className="mt-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-200">{children}</div>
      )}
    </div>
  );
};
