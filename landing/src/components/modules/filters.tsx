import { Switch } from "@/components/ui/switch";
import { Cat, Dog, Fish, Rabbit, Turtle } from "lucide-react";
import { useState } from "react";
import { MultiSelect } from "../ui/multi-select";

const frameworksList = [
  { value: "react", label: "React", icon: Turtle },
  { value: "angular", label: "Angular", icon: Cat },
  { value: "vue", label: "Vue", icon: Dog },
  { value: "svelte", label: "Svelte", icon: Rabbit },
  { value: "ember", label: "Ember", icon: Fish },
];

export const AttributeFilters = () => {
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(["react", "angular"]);
  return (
    <div className="w-full flex justify-between items-center pb-4 gap-8">
      <MultiSelect
        options={frameworksList}
        onValueChange={setSelectedFrameworks}
        defaultValue={selectedFrameworks}
        placeholder="Select Resources"
        variant="inverted"
        animation={2}
        maxCount={3}
      />
      <Switch />
    </div>
  );
};
