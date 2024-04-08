import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import TextInput from "@/ui/elements/TextInput";
import { findResourceById, getIconResourceId, resources } from "@bibliothecadao/eternum";

export const ResourceSwap = () => {
  return (
    <div>
      <div className="p-2 relative">
        <SwapBar />

        <div className="w-full mt-2 absolute top-1/3 left-1/3">
          <Button className="text-brown" onClick={() => console.log("")} variant="primary">
            Swap
          </Button>
        </div>

        <SwapBar />
      </div>
      <div className="p-2">
        <h3>Rate: 1:1</h3>
        <Button onClick={() => console.log("")} variant="primary">
          Swap
        </Button>
      </div>
    </div>
  );
};

export const SwapBar = () => {
  return (
    <div className="w-full rounded border p-2 flex justify-between">
      <div className="self-center">
        <TextInput value="0" onChange={() => {}} />
      </div>

      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Resources" />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
          {resources.map((resource, index) => (
            <SelectItem key={index} value={resource.trait}>
              <div className="flex">
                <ResourceIcon
                  withTooltip={false}
                  resource={findResourceById(getIconResourceId(resource.id, false))?.trait as string}
                  size="md"
                  className="mr-1"
                />
                {resource.trait}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
