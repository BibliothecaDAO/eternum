import Button from "@/ui/design-system/atoms/button";
import { BasePopup } from "@/ui/design-system/molecules/base-popup";
import React, { useState } from "react";

interface NameChangePopupProps {
  currentName: string;
  originalName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const NameChangePopup: React.FC<NameChangePopupProps> = ({
  currentName,
  originalName,
  onConfirm,
  onCancel,
  onDelete,
}) => {
  const [newName, setNewName] = useState(currentName);

  const isNameUnchanged = newName === currentName;
  const isOriginalName = currentName === originalName;
  const isNameEmpty = newName.trim() === "";

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const footer = (
    <div className="flex justify-center space-x-4">
      <Button variant="danger" onClick={onDelete}>
        Remove Name
      </Button>
      <Button variant="gold" onClick={() => onConfirm(newName)} disabled={isNameUnchanged || isNameEmpty}>
        Save Changes
      </Button>
    </div>
  );

  return (
    <BasePopup title="Change Structure Name" onClose={onCancel} footer={footer} contentClassName="">
      <div onKeyDown={handleKeyDown}>
        <div className="mb-4">
          <p className="text-sm text-gold/80">Current name: {currentName}</p>
          {!isOriginalName && <p className="text-sm text-gold/80">Original name: {originalName}</p>}
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="bg-brown/20 border border-gold/30 rounded w-full px-3 py-2 text-gold mb-4"
          placeholder="Enter new name"
        />
        <p className="text-sm text-gold/60 mb-4">
          Note: This change is only visible to you locally and not to other players
        </p>
      </div>
    </BasePopup>
  );
};
