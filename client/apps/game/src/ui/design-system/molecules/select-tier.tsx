import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { TroopTier } from "@bibliothecadao/types";
import React, { useState } from "react";

interface SelectTierProps {
  onSelect: (tier: TroopTier | null) => void;
  className?: string;
  defaultValue?: TroopTier;
}

export const SelectTier: React.FC<SelectTierProps> = ({ onSelect, className, defaultValue = TroopTier.T1 }) => {
  const [selectedTier, setSelectedTier] = useState<string>(defaultValue?.toString() || "");

  // Call onSelect with default value on mount
  React.useEffect(() => {
    if (defaultValue !== undefined) {
      onSelect(defaultValue);
    }
  }, []);

  return (
    <Select
      value={selectedTier}
      onValueChange={(value) => {
        setSelectedTier(value);
        onSelect(value as TroopTier);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select tier" />
      </SelectTrigger>
      <SelectContent>
        {[TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => (
          <SelectItem key={tier} value={tier.toString()}>
            <div className="flex items-center">
              <span>{tier}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
