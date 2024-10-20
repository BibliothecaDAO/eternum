import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface SeasonPassProps {
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export const SeasonPass = ({ title, description, checked, onChange }: SeasonPassProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2">
          {title} <Checkbox checked={checked} onCheckedChange={onChange} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};
