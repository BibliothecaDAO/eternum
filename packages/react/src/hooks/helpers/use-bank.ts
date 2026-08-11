import { configManager, DEFAULT_COORD_ALT, gameEntityKey } from "@bibliothecadao/eternum";
import { BANDITS_NAME, ID } from "@bibliothecadao/types";
import { getComponentValue, getComponentValueStrict } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { useDojo } from "../";

export const useBank = (bankEntityId: ID) => {
  const {
    setup: {
      components: { AddressName, Structure },
    },
  } = useDojo();

  const entity = gameEntityKey([BigInt(bankEntityId)]);

  const structure = getComponentValueStrict(Structure, entity);

  const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(structure.owner)]));

  return {
    entityId: structure.entity_id,
    position: { alt: DEFAULT_COORD_ALT, x: structure.base.coord_x, y: structure.base.coord_y },
    owner: addressName?.name ? shortString.decodeShortString(addressName.name.toString()) : BANDITS_NAME,
    structure,
    // bank_config is a rulebook member: PresetConfig on s2, inline WorldConfig
    // on legacy worlds — configManager dispatches per arm.
    ownerFee: configManager.getAdminBankOwnerFee(),
  };
};
