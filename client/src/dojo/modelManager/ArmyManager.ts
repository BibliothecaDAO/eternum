import { DojoResult } from "@/hooks/context/DojoContext";
import { ID } from "@bibliothecadao/eternum";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export class ArmyManager {
  constructor(private dojo: DojoResult) {}

  async deleteArmy(armyId: ID): Promise<void> {
    await this.dojo.setup.systemCalls
      .delete_army({
        signer: this.dojo.account.account,
        army_id: armyId,
      })
      .then(() => {
        this.dojo.network.world.deleteEntity(getEntityIdFromKeys([BigInt(armyId)]));
      });
  }
}
