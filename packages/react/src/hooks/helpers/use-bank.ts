import { DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import { ID, BANDITS_NAME, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { getComponentValue, getComponentValueStrict } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { useDojo } from "../";

export const useBank = (bankEntityId: ID) => {
  const {
    setup: {
      components: { AddressName, Structure, WorldConfig },
    },
  } = useDojo();

  const entity = getEntityIdFromKeys([BigInt(bankEntityId)]);

  const structure = getComponentValueStrict(Structure, entity);

  const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(structure.owner)]));
  // Banks exist only on legacy (s1) worlds; the member is gone from the s2 schema.
  const bankConfig = (
    getComponentValue(WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID])) as unknown as { bank_config?: any }
  )?.bank_config;
  return {
    entityId: structure.entity_id,
    position: { alt: DEFAULT_COORD_ALT, x: structure.base.coord_x, y: structure.base.coord_y },
    owner: addressName?.name ? shortString.decodeShortString(addressName.name.toString()) : BANDITS_NAME,
    structure,
    ownerFee: Number(bankConfig?.owner_fee_num) / Number(bankConfig?.owner_fee_denom),
  };
};
