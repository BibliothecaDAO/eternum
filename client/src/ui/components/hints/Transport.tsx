import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { BuildingType, EternumGlobalConfig, WEIGHTS } from "@bibliothecadao/eternum";

export const Transport = () => {
  return (
    <div>
      <h2>Transport</h2>
      <p>
        Within the market panel you can transfer resources to other locations on the map. Make sure to have donkeys!
      </p>

      <h2>Donkeys</h2>
      <p>
        Donkeys play an important role in Eternum. They all you to transfer resources around. They have a capacity and
        each type of material has a weight.
      </p>

      <p>Donkey carry capacity: {EternumGlobalConfig.carryCapacity.donkey}kg</p>

      <div className="flex mt-4 justify-center w-full gap-8 font-bold border p-2">
        <div className="ml-2">Lords: {`${WEIGHTS[253]} kg/unit`}</div>
        <div>Food: {`${WEIGHTS[254]} kg/unit`}</div>
        <div className="ml-2">Resource: {`${WEIGHTS[1]} kg/unit`}</div>
      </div>

      <h2>Producing Donkeys</h2>
      <div className="flex gap-3">
        <img src={BUILDING_IMAGES_PATH[BuildingType.Market]} alt="" />
        <p>You can produce donkeys via a market or purchase them off the market.</p>
      </div>
    </div>
  );
};
