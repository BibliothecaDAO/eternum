import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import * as React from "react";

interface NumericKeyboardProps {
  onKeyPress: (value: string) => void;
  className?: string;
}

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

export function NumericKeyboard({ onKeyPress, className }: NumericKeyboardProps) {
  // Add keyboard event listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle numbers and decimal point
      if (/^[0-9.]$/.test(e.key)) {
        onKeyPress(e.key);
      }
      // Handle backspace
      else if (e.key === "Backspace") {
        onKeyPress("⌫");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onKeyPress]);

  return (
    <div className={cn("grid grid-cols-3 gap-2 p-2 bg-background rounded-lg", className)}>
      {keys.map((row, rowIndex) => (
        <React.Fragment key={rowIndex}>
          {row.map((key) => (
            <Button key={key} variant="ghost" className="h-14 text-xl font-medium" onClick={() => onKeyPress(key)}>
              {key}
            </Button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
