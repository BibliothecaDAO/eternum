import CaretDown from "@public/icons/caret-down.svg?react";
import { useEffect, useRef, useState } from "react";
import { ButtonLike } from "./button-like";

export const Dropdown = ({
  options,
  label,
  selectCallback,
}: {
  options: readonly string[];
  label?: string;
  selectCallback?: (option: string) => void;
}) => {
  const [selectedOption, setSelectedOption] = useState(options[0]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <ButtonLike className="bg-[#000000]/50  hover:bg-[#ffffff]/10" onClick={() => setIsOpen(!isOpen)}>
        <div>{label ?? selectedOption}</div>
        <CaretDown />
      </ButtonLike>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 rounded shadow-lg z-10 w-max h-fit">
          {options.map((option) => (
            <div
              className="cursor-pointer select-none py-[8px] px-[12px] text-white bg-[#000000]/50 hover:bg-[#ffffff]/10 backdrop-blur-2xl transition-all duration-100 ease-in-out hover:relative hover:bottom-0.5 hover:shadow-[0px_2px_0px_0px_rgba(0,0,0,0.25)] first:rounded-t last:rounded-b"
              key={option}
              onClick={() => {
                setSelectedOption(option);
                setIsOpen(false);
                selectCallback?.(option);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
