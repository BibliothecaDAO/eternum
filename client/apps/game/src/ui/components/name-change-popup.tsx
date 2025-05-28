import Button from "@/ui/elements/button";
import { X } from "lucide-react";
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

  return (
    <div
      className="fixed inset-0 bg-brown bg-opacity-60 z-50 flex justify-center items-center"
      onKeyDown={handleKeyDown}
    >
      <div className="border border-gold/10 bg-brown/90 panel-wood rounded p-8 w-full max-w-md mx-auto flex flex-col items-center relative">
        <div className="absolute top-3 right-3">
          <Button className="!p-4" size="xs" variant="default" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <h4 className="text-xl font-bold">Change Structure Name</h4>
        <div className="text-center mt-4 w-full">
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
        <div className="flex justify-center mt-4 w-full">
          <div className="flex justify-center space-x-4">
            <Button variant="danger" onClick={onDelete}>
              Remove Name
            </Button>
            <Button variant="gold" onClick={() => onConfirm(newName)} disabled={isNameUnchanged || isNameEmpty}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
