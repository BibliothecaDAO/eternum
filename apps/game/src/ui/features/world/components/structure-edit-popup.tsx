import { useEffect, useState } from "react";

import { HudButton, HudField, HudWindow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";

type StructureEditPopupProps = {
  currentName: string;
  originalName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
};

export const StructureEditPopup = ({ currentName, originalName, onConfirm, onCancel }: StructureEditPopupProps) => {
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
      </div>
    </HudWindow>
  );
};
