import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import React, { useState } from "react";

interface SelectTierProps {
  onSelect: (tier: number | null) => void;
  className?: string;
  defaultValue?: number;
}

export const SelectTier: React.FC<SelectTierProps> = ({ onSelect, className, defaultValue = 1 }) => {
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
        onSelect(value ? parseInt(value) : null);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select tier" />
      </SelectTrigger>
      <SelectContent>
        {[1, 2, 3].map((tier) => (
          <SelectItem key={tier} value={tier.toString()}>
            <div className="flex items-center">
              <span>Tier {tier}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
