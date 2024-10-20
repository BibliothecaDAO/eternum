import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface SeasonPassProps {
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export const SeasonPass = ({ title, description, checked: initialChecked, onChange }: SeasonPassProps) => {
  const [isChecked, setIsChecked] = useState(initialChecked);

  const handleCardClick = () => {
    const newCheckedState = !isChecked;
    setIsChecked(newCheckedState);
    onChange?.(newCheckedState);
  };

  return (
    <Card onClick={handleCardClick} className="cursor-pointer">
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2">
          {title} <Checkbox checked={isChecked} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};
