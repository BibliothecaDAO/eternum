import React from "react";

import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";

import { TransferMode } from "@/hooks/store/use-automation-store";

import { formatMinutes } from "@/shared/lib/time";

interface TransferModeControlsProps {
  mode: TransferMode;
  onModeChange: (mode: TransferMode) => void;
  interval: number;
  onIntervalChange: (value: number) => void;
  threshold: number;
  onThresholdChange: (value: number) => void;
}

export const TransferModeControls: React.FC<TransferModeControlsProps> = ({
  mode,
  onModeChange,
  interval,
  onIntervalChange,
  threshold,
  onThresholdChange,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block mb-1 text-sm font-medium">Transfer Mode:</label>
        <Select value={mode} onValueChange={(value: TransferMode) => onModeChange(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TransferMode.Recurring}>Recurring</SelectItem>
            <SelectItem value={TransferMode.MaintainStock}>Maintain Stock</SelectItem>
            <SelectItem value={TransferMode.DepletionTransfer}>Depletion Transfer</SelectItem>
          </SelectContent>
        </Select>
        <ul className="list-disc pl-4 mb-4 text-xs text-gold/70">
          <li>
            <span className="font-bold">Recurring:</span> Transfer resources at regular intervals (minimum 10 minutes).
          </li>
          <li>
            <span className="font-bold">Maintain Stock:</span> Transfer when destination balance falls below threshold.
          </li>
          <li>
            <span className="font-bold">Depletion Transfer:</span> Transfer when source balance exceeds threshold.
          </li>
        </ul>
      </div>

      <div>
        {mode === TransferMode.Recurring && (
          <>
            <label className="block mb-1 text-sm font-medium">Transfer Interval (minutes):</label>
            <NumberInput value={interval} onChange={onIntervalChange} min={10} max={10080} className="w-full" />
            {interval < 10 && (
              <div className="text-xs text-red/90 bg-red/10 rounded p-1 mt-1">
                ⚠️ Automation runs every minute. Intervals less than 1 minute will transfer every minute.
              </div>
            )}
            <div className="flex gap-1 mt-1">
              {[10, 30, 60, 120, 360, 1440].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onIntervalChange(preset)}
                  className="text-xs px-2 py-1 bg-gold/10 hover:bg-gold/20 rounded"
                >
                  {preset >= 60 ? `${preset / (preset >= 60 ? 60 : 1)}${preset >= 60 ? "h" : "m"}` : `${preset}m`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gold/50 mt-1">
              Transfer will occur every {formatMinutes(interval)}
              {interval === 10 && " (minimum interval due to automation cycle)"}
            </p>
          </>
        )}

        {(mode === TransferMode.MaintainStock || mode === TransferMode.DepletionTransfer) && (
          <>
            <label className="block mb-1 text-sm font-medium">Threshold Amount:</label>
            <NumberInput value={threshold} onChange={onThresholdChange} min={1} className="w-full" />
            <p className="text-xs text-gold/50 mt-1">
              {mode === TransferMode.MaintainStock
                ? "Transfer when destination has less than this amount."
                : "Transfer when source has more than this amount."}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
