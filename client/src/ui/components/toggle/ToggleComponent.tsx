import clsx from "clsx";
import { ArrowDown } from "lucide-react";
import React, { useEffect, useState } from "react";

interface ToggleComponentProps {
  title: string;
  children: React.ReactNode;
  initialOpen?: boolean;
  searchTerm?: string;
}

export const ToggleComponent: React.FC<ToggleComponentProps> = ({
  title,
  children,
  initialOpen = false,
  searchTerm,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  useEffect(() => {
    if (searchTerm !== undefined) {
      setIsOpen(false);
    }
  }, [searchTerm]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const effectiveIsOpen = initialOpen ? initialOpen && !isOpen : isOpen;

  return (
    <div className="w-full">
      <button
        onClick={toggleOpen}
        className="mt-2 w-full transition-all duration-200 border-b border-gold/20 p-2 flex justify-between items-center text-lg font-bold"
      >
        <span>{title}</span>
        <ArrowDown className={clsx("transition-transform", isOpen && "rotate-180")} />
      </button>
      <div
        className={clsx(
          "transition-max-height duration-300 ease-in-out overflow-hidden",
          effectiveIsOpen ? "max-h-[500px] visible" : "max-h-0 invisible",
        )}
      >
        {children}
      </div>
    </div>
  );
};
