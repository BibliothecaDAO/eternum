import { useEffect, useState } from "react";

import { HudButton, HudField, HudWindow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
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
  const renamed = Boolean(originalName) && originalName !== currentName;

  return (
    <HudWindow title="Edit Structure" size="task" onClose={onCancel}>
      <HudWindowFoot>
        <HudButton kind="quiet" onClick={onCancel}>
          Cancel
        </HudButton>
        <HudButton kind="primary" disabled={isNameUnchanged || isNameEmpty} onClick={() => onConfirm(trimmedName)}>
          Save Changes
        </HudButton>
      </HudWindowFoot>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-hud-label text-hud-muted">Structure Name</span>
          <div className="flex items-center gap-2">
            <HudField value={newName} aria-label="Structure name" placeholder="Enter new name" onChange={setNewName} />
            {renamed && (
              <HudButton kind="secondary" size="sm" onClick={() => setNewName(originalName)}>
                Restore
              </HudButton>
            )}
          </div>
          {renamed && <span className="text-hud-label text-hud-muted">Original name: {originalName}</span>}
          <span className="text-hud-label text-hud-cue">
            This change is only visible locally and does not sync with other players.
          </span>
        </div>

        {onUpdateColor && <GroupColors chosen={groupColor} onChoose={onUpdateColor} />}
      </div>
    </HudWindow>
  );
};

/** The structure's group: none, or one of the player's six colours, the chosen one pressed. */
const GroupColors = ({
  chosen,
  onChoose,
}: {
  chosen: StructureGroupColor | null;
  onChoose: (color: StructureGroupColor | null) => void;
}) => (
  <div className="flex flex-col gap-2">
    <span className="text-hud-label text-hud-muted">Structure Color</span>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Structure color">
      <HudButton
        kind="secondary"
        size="sm"
        aria-label="No color"
        aria-pressed={chosen === null}
        onClick={() => onChoose(null)}
      >
        —
      </HudButton>
      {STRUCTURE_GROUP_COLORS.map((color) => (
        <HudButton
          key={color.value}
          kind="secondary"
          size="sm"
          aria-label={color.label}
          aria-pressed={chosen === color.value}
          onClick={() => onChoose(color.value)}
        >
          <span className={`h-3 w-3 rounded-full ${color.dotClass}`} />
        </HudButton>
      ))}
    </div>
  </div>
);
