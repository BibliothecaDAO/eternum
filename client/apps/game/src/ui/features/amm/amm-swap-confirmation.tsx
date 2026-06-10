import { Button } from "@/ui/design-system/atoms";
import { DialogShell } from "@/ui/design-system/molecules";
import { useCallback, useState } from "react";

interface AmmSwapConfirmationProps {
  sellingAmount: string;
  sellingToken: string;
  receivingAmount: string;
  receivingToken: string;
  priceImpact: string;
  slippageTolerance: string;
  minimumReceived: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const AmmSwapConfirmation = ({
  sellingAmount,
  sellingToken,
  receivingAmount,
  receivingToken,
  priceImpact,
  slippageTolerance,
  minimumReceived,
  onConfirm,
  onCancel,
}: AmmSwapConfirmationProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm]);

  return (
    <DialogShell title="Confirm Swap" onClose={onCancel} size="md" contentClassName="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gold/60">Selling</span>
        <span className="text-gold">
          {sellingAmount} {sellingToken}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gold/60">Receiving</span>
        <span className="text-gold">
          {receivingAmount} {receivingToken}
        </span>
      </div>
      <div className="border-t border-gold/20 my-2" />
      <div className="flex justify-between">
        <span className="text-gold/60">Price Impact</span>
        <span className={parseFloat(priceImpact) > 5 ? "text-danger" : "text-gold"}>{priceImpact}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gold/60">Slippage Tolerance</span>
        <span className="text-gold">{slippageTolerance}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gold/60">Minimum Received</span>
        <span className="text-gold">{minimumReceived}</span>
      </div>

      <div className="flex gap-3 pt-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="gold" className="flex-1" onClick={handleConfirm} isLoading={isLoading}>
          Confirm Swap
        </Button>
      </div>
    </DialogShell>
  );
};
