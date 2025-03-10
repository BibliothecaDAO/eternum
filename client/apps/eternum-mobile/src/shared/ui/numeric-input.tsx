import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { NumericKeyboard } from "@/shared/ui/numeric-keyboard";
import * as React from "react";

export interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "type"> {
  value: number;
  onChange?: (value: number) => void;
  label?: string;
  description?: string;
  className?: string;
  inputClassName?: string;
}

export function NumericInput({
  value,
  onChange,
  label = "Enter Amount",
  description,
  className,
  inputClassName,
  ...props
}: NumericInputProps) {
  const [showKeyboard, setShowKeyboard] = React.useState(false);

  const handleKeyPress = (key: string) => {
    if (!onChange) return;

    if (key === "⌫") {
      // Handle backspace
      onChange(Math.floor(value / 10));
    } else {
      // Handle number or decimal point
      const newValue = value.toString() + key;
      if (!isNaN(parseFloat(newValue))) {
        onChange(parseFloat(newValue));
      }
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <Input
        type="number"
        value={value}
        readOnly
        inputMode="none"
        onFocus={(e) => {
          e.preventDefault();
          e.target.blur();
          setShowKeyboard(true);
        }}
        onClick={() => setShowKeyboard(true)}
        className={cn(inputClassName)}
        {...props}
      />

      <Drawer open={showKeyboard} onOpenChange={setShowKeyboard}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-3xl font-bokor text-center">{label}</DrawerTitle>
            <DrawerDescription className="text-xl">
              {value} {description || ""}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <NumericKeyboard onKeyPress={handleKeyPress} />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button className="w-full" size="lg">
                Confirm
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
