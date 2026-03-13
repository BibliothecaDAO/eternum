import type { Signer } from "../config";

export class TradeTransactions {
  constructor(private provider: any) {}

  async createOrder(
    signer: Signer,
    props: {
      makerId: number;
      takerId: number;
      makerGivesResourceType: number;
      takerPaysResourceType: number;
      makerGivesMinResourceAmount: number;
      makerGivesMaxCount: number;
      takerPaysMinResourceAmount: number;
      expiresAt: number;
    },
  ) {
    return this.provider.create_order({
      signer,
      maker_id: props.makerId,
      taker_id: props.takerId,
      maker_gives_resource_type: props.makerGivesResourceType,
      taker_pays_resource_type: props.takerPaysResourceType,
      maker_gives_min_resource_amount: props.makerGivesMinResourceAmount,
      maker_gives_max_count: props.makerGivesMaxCount,
      taker_pays_min_resource_amount: props.takerPaysMinResourceAmount,
      expires_at: props.expiresAt,
    });
  }

  async acceptOrder(
    signer: Signer,
    props: {
      takerId: number;
      tradeId: number;
      takerBuysCount: number;
    },
  ) {
    return this.provider.accept_order({
      signer,
      taker_id: props.takerId,
      trade_id: props.tradeId,
      taker_buys_count: props.takerBuysCount,
    });
  }

  async cancelOrder(
    signer: Signer,
    props: {
      tradeId: number;
    },
  ) {
    return this.provider.cancel_order({
      signer,
      trade_id: props.tradeId,
    });
  }
}
