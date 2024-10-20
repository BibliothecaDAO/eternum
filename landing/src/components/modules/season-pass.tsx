import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { TypeH4 } from "../typography/type-h4";
import { TypeP } from "../typography/type-p";

export interface SeasonPassProps {
  title: string;
  description: string;
  checked?: boolean;
  owner?: string;
  onChange?: (checked: boolean) => void;
}

export const SeasonPass = ({ title, description, checked: initialChecked, owner, onChange }: SeasonPassProps) => {
  const [isChecked, setIsChecked] = useState(initialChecked);

  const handleCardClick = () => {
    const newCheckedState = !isChecked;
    setIsChecked(newCheckedState);
    onChange?.(newCheckedState);
  };

  return (
    <Card
      onClick={handleCardClick}
      className={`cursor-pointer transition-all duration-200 hover:border-gold ${isChecked ? "border-gold" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2">
          <TypeH4> {title}</TypeH4> <Checkbox checked={isChecked} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <TypeP>{owner}</TypeP>
      </CardContent>
    </Card>
  );
};
