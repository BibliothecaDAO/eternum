import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getQuestFromToriiEntity = (entityData: any) => {
  const coordValue = entityData.coord?.value;
  const quest: ComponentValue<ClientComponents["QuestTile"]["schema"]> = {
    id: entityData.id?.value,
    game_address: entityData.game_address?.value,
    coord: {
      alt: coordValue?.alt?.value ?? coordValue?.alt ?? false,
      x: coordValue?.x?.value ?? coordValue?.x,
      y: coordValue?.y?.value ?? coordValue?.y,
    },
    level: entityData.level?.value,
    resource_type: entityData.resource_type?.value,
    amount: entityData.amount?.value,
    capacity: entityData.capacity?.value,
    participant_count: entityData.participant_count?.value,
  };

  return quest;
};
