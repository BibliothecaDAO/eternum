import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { MultiSelect } from "../ui/multi-select";

import { ResourcesIds } from "@bibliothecadao/eternum";

const frameworksList = Object.values(ResourcesIds)
  .filter((value) => isNaN(Number(value)))
  .map((value) => ({
    value: value.toString(),
    label: value.toString(),
  }));

export const AttributeFilters = () => {
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(
    Object.values(ResourcesIds)
      .filter((value) => isNaN(Number(value)))
      .map((value) => value.toString()),
  );
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
