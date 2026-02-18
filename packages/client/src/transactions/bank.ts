import type { Signer } from "../config";

export class BankTransactions {
  constructor(private provider: any) {}

  async buy(
    signer: Signer,
    props: {
      bankEntityId: number;
      entityId: number;
      resourceType: number;
      amount: number;
    },
  ) {
    return this.provider.buy_resources({
      signer,
      bank_entity_id: props.bankEntityId,
      entity_id: props.entityId,
      resource_type: props.resourceType,
      amount: props.amount,
    });
  }

  async sell(
    signer: Signer,
    props: {
      bankEntityId: number;
      entityId: number;
      resourceType: number;
      amount: number;
    },
  ) {
    return this.provider.sell_resources({
      signer,
      bank_entity_id: props.bankEntityId,
      entity_id: props.entityId,
      resource_type: props.resourceType,
      amount: props.amount,
    });
  }

  async addLiquidity(
    signer: Signer,
    props: {
      bankEntityId: number;
      entityId: number;
      calls: { resourceType: number; resourceAmount: number; lordsAmount: number }[];
    },
  ) {
    return this.provider.add_liquidity({
      signer,
      bank_entity_id: props.bankEntityId,
      entity_id: props.entityId,
      calls: props.calls.map((c) => ({
        resource_type: c.resourceType,
        resource_amount: c.resourceAmount,
        lords_amount: c.lordsAmount,
      })),
    });
  }

  async removeLiquidity(
    signer: Signer,
    props: {
      bankEntityId: number;
      entityId: number;
      resourceType: number;
      shares: number;
    },
  ) {
    return this.provider.remove_liquidity({
      signer,
      bank_entity_id: props.bankEntityId,
      entity_id: props.entityId,
      resource_type: props.resourceType,
      shares: props.shares,
    });
  }
}
