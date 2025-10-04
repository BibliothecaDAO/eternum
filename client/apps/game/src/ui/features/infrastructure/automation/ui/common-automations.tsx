import React from "react";

import Button from "@/ui/design-system/atoms/button";

import type { CommonAutomationPreset } from "../model/common-automations";
import type { AutomationOrder } from "@/hooks/store/use-automation-store";

interface CommonAutomationsProps {
  presets: CommonAutomationPreset[];
  isRealmPaused: boolean;
  onApply: (order: Omit<AutomationOrder, "id" | "producedAmount">) => void;
}

export const CommonAutomations: React.FC<CommonAutomationsProps> = ({ presets, isRealmPaused, onApply }) => {
  if (presets.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h5 className="text-sm font-semibold mb-2">Common Automations</h5>
      <div className="grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => {
          const isDisabled = !preset.available || isRealmPaused;
          const disabledReason = preset.unavailableReason || (isRealmPaused ? "Realm is paused" : undefined);

          return (
            <div key={preset.id} className="border border-gold/20 rounded-lg p-3 bg-black/20 flex flex-col gap-2">
              <div>
                <div className="text-sm font-medium text-gold/90">{preset.title}</div>
                <p className="text-xs text-gold/70 mt-1">{preset.description}</p>
              </div>
              <div className="flex items-center justify-between mt-auto">
                {isDisabled && disabledReason ? (
                  <span className="text-[11px] text-gold/60">{disabledReason}</span>
                ) : (
                  <span className="text-[11px] text-gold/60">Ready to add</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isDisabled || !preset.order}
                  onClick={() => {
                    if (preset.order) {
                      onApply(preset.order);
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
