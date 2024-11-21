import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";

export const Troops = ({
  troops,
  setTroops,
}: {
  troops: Partial<Record<ResourcesIds, bigint>>;
  setTroops?: React.Dispatch<React.SetStateAction<Partial<Record<ResourcesIds, bigint>>>>;
}) => {
  return (
    <div className={setTroops ? "grid grid-rows-3" : "grid grid-cols-3"}>
      {Object.entries(troops).map(([resource, count]) => (
        <div className={`p-2 bg-gold/10 hover:bg-gold/30 `} key={resource}>
          <div className="font-bold mb-4">
            <div className="flex justify-between text-center">
              <div className="text-md">
                {(ResourcesIds[resource as keyof typeof ResourcesIds] as unknown as string).length > 7
                  ? (ResourcesIds[resource as keyof typeof ResourcesIds] as unknown as string).slice(0, 7) + "..."
                  : ResourcesIds[resource as keyof typeof ResourcesIds]}
              </div>
            </div>
            <div className="py-1 flex flex-row justify-between">
              <ResourceIcon
                withTooltip={false}
                resource={ResourcesIds[resource as keyof typeof ResourcesIds] as unknown as string}
                size="lg"
              />
              {!setTroops && <div className="text-lg w-full">{currencyFormat(Number(count), 0)}</div>}
              {setTroops && (
                <NumberInput
                  min={0}
                  step={100}
                  value={Number(count)}
                  onChange={(amount) => setTroops({ ...troops, [resource]: BigInt(amount) })}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
