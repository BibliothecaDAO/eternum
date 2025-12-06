import { useEffect, useState } from "react";

import Button from "@/ui/design-system/atoms/button";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import {
  STRUCTURE_GROUP_COLORS,
  StructureGroupColor,
} from "@/ui/features/world/containers/top-header/structure-groups";

type StructureEditPopupProps = {
  currentName: string;
  originalName: string;
  groupColor: StructureGroupColor | null;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  onUpdateColor?: (color: StructureGroupColor | null) => void;
};

export const StructureEditPopup = ({
  currentName,
  originalName,
  groupColor,
  onConfirm,
  onCancel,
  onUpdateColor,
}: StructureEditPopupProps) => {
  const [newName, setNewName] = useState(currentName);

  useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  const trimmedName = newName.trim();
  const isNameUnchanged = trimmedName === currentName.trim();
  const isNameEmpty = trimmedName === "";

  return (
    <SecondaryPopup width="480" name="structure-edit-popup" containerClassName="absolute left-0 top-0 pointer-events-auto">
      <SecondaryPopup.Head onClose={onCancel}>Edit Structure</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="auto">
        <div className="flex flex-col gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold/60">Structure Name</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="w-full rounded border border-gold/30 bg-black/60 px-3 py-2 text-sm text-gold placeholder-gold/50 focus:border-gold/60 focus:outline-none"
                placeholder="Enter new name"
              />
              {originalName && originalName !== currentName && (
                <Button variant="default" size="sm" onClick={() => setNewName(originalName)}>
                  Restore
                </Button>
              )}
            </div>
            {originalName && originalName !== currentName && (
              <p className="mt-1 text-xxs text-gold/60">Original name: {originalName}</p>
            )}
            <p className="mt-2 text-xxs text-gold/50">
              This change is only visible locally and does not sync with other players.
            </p>
          </div>

          {onUpdateColor && (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold/60">Structure Color</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateColor(null)}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition ${
                    groupColor === null ? "border-gold text-gold" : "border-gold/30 text-gold/70 hover:border-gold/50"
                  }`}
                >
                  <span className="text-gold">—</span>
                </button>
                {STRUCTURE_GROUP_COLORS.map((color) => {
                  const isSelected = groupColor === color.value;
                  return (
                    <button
                      type="button"
                      key={color.value}
                      onClick={() => onUpdateColor(color.value)}
                      className={`flex items-center gap-2 rounded border px-2 py-1 text-xs transition ${
                        isSelected
                          ? "border-gold text-gold ring-1 ring-gold/60"
                          : "border-gold/30 text-gold/70 hover:border-gold/50"
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full ${color.dotClass}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center justify-start gap-2 border-t border-gold/20 pt-4">
            <Button variant="gold" disabled={isNameUnchanged || isNameEmpty} onClick={() => onConfirm(trimmedName)}>
              Save Changes
            </Button>
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
