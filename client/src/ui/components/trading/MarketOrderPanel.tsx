import Button from "@/ui/elements/Button";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import TextInput from "@/ui/elements/TextInput";
import { Resource, Resources } from "@bibliothecadao/eternum";

export const MarketResource = ({
  resource,
  active,
  onClick,
}: {
  resource: Resources;
  active: boolean;
  onClick: (value: number) => void;
}) => {
  return (
    <div
      onClick={() => onClick(resource.id)}
      className={`w-full border border-gold/20 h-8 p-1 flex gap-4 ${active ? "bg-gold text-brown" : ""}`}
    >
      <ResourceIcon size="sm" resource={resource.trait} />
      {resource.trait}

      <div className="ml-auto flex gap-3">
        <div>0.12</div>
        <div>0.12</div>
      </div>
    </div>
  );
};

export const MarketOrderPanel = () => {
  return (
    <div className="grid grid-cols-2 gap-8 p-8 h-full">
      <MarketOrders />
      <MarketOrders />
    </div>
  );
};

export const MarketOrders = () => {
  return (
    <div className=" h-full flex flex-col gap-8">
      {/* Market Price */}
      <div className=" text-xl flex  justify-between p-3 border">
        <div className="self-center">0.12</div>
      </div>

      {/* MarketList */}

      <div className=" p-4 bg-white/10 flex-col flex gap-2 h-full">
        <OrderRowHeader />
        <OrderRow />
        <OrderRow />
        <OrderRow />
      </div>

      <OrderCreation />
    </div>
  );
};

export const OrderRowHeader = () => {
  return (
    <div className="flex justify-between p-2 uppercase text-xs">
      <div>quantity</div>
      <div>distance</div>
      <div>price per/unit</div>
      <div>accept</div>
    </div>
  );
};

export const OrderRow = () => {
  return (
    <div className="flex justify-between p-2 border text-xl">
      <div>0.12</div>
      <div>100</div>
      <div>100</div>
      <Button size="md" variant="primary">
        accept
      </Button>
    </div>
  );
};

export const OrderCreation = () => {
  return (
    <div className="flex justify-between p-2 border text-xl flex-wrap mt-auto">
      <div className="flex w-full gap-8">
        <div>
          <div className="uppercase text-xs">resource</div>
          <TextInput value="1" onChange={() => console.log("s")} />
        </div>
        <div>
          <div className="uppercase text-xs">bid</div>
          <TextInput value="1" onChange={() => console.log("s")} />
        </div>
        <div>
          <div className="uppercase text-xs">lords</div>
          <TextInput value="1" onChange={() => console.log("s")} />
        </div>
      </div>
      <div className="mt-8 ml-auto text-right p-4">
        <div>Donkeys needed 1000</div>
        <div>Weight 2000</div>
        <Button size="md" variant="primary">
          Create Order
        </Button>
      </div>
    </div>
  );
};
