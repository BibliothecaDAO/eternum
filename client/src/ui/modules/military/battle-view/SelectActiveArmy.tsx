import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";

export const SelectActiveArmy = ({
  localSelectedUnit,
  setLocalSelectedUnit,
  userAttackingArmies,
}: {
  localSelectedUnit: bigint | undefined;
  setLocalSelectedUnit: (val: any) => void;
  userAttackingArmies: ArmyInfo[];
}) => {
  return (
    <div className="self-center flex flex-col justify-between bg-gold clip-angled size-xs mb-1 mr-1">
      <Select
        value={""}
        onValueChange={(a: string) => {
          setLocalSelectedUnit(BigInt(a));
        }}
      >
        <SelectTrigger className="">
          <SelectValue
            placeholder={
              userAttackingArmies.find((army) => localSelectedUnit === BigInt(army.entity_id))?.name || "Select army"
            }
          />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
          {userAttackingArmies.map((army, index) => (
            <SelectItem className="flex justify-between text-sm" key={index} value={army.entity_id?.toString() || ""}>
              <h5 className="self-center flex gap-4">{army.name}</h5>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
