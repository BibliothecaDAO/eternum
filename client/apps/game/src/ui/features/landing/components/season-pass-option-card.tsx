import type { SeasonPassInventoryItem } from "@/hooks/use-season-pass-inventory";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { SettlementResourceBadges } from "./settlement-resource-badges";

export const SeasonPassOptionCard = ({
  pass,
  isSelected,
  onSelect,
  className,
}: {
  pass: SeasonPassInventoryItem;
  isSelected: boolean;
  onSelect: (tokenId: bigint) => void;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-lg border p-2 transition-colors",
      isSelected ? "border-gold/55 bg-gold/15" : "border-gold/20 bg-black/25 hover:border-gold/35",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm text-gold truncate">{pass.realmName}</p>
        <p className="text-[11px] text-gold/50">Realm #{pass.realmId}</p>
      </div>
      <Button
        onClick={() => onSelect(pass.tokenId)}
        variant={isSelected ? "default" : "outline"}
        size="xs"
        forceUppercase={false}
        className={cn(isSelected ? "!bg-gold !text-brown" : "")}
      >
        {isSelected ? "Selected" : "Use"}
      </Button>
    </div>

    <SettlementResourceBadges resourceIds={pass.resourceIds} className="mt-2" />
  </div>
);
