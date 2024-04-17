import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { LiquidityType, MarketType, ProductionType, ResourceType } from "./types";

export class MarketManager {
  marketModel: Component<MarketType> | OverridableComponent<MarketType>;
  liquidityModel: Component<LiquidityType> | OverridableComponent<LiquidityType>;
  bankEntityId: bigint;
  player: bigint;
  resourceId: bigint;

  constructor(
    marketModel: Component<MarketType> | OverridableComponent<MarketType>,
    liquidityModel: Component<LiquidityType> | OverridableComponent<LiquidityType>,
    bankEntityId: bigint,
    player: bigint,
    resourceId: bigint,
  ) {
    this.marketModel = marketModel;
    this.liquidityModel = liquidityModel;
    this.bankEntityId = bankEntityId;
    this.resourceId = resourceId;
    this.player = player;
  }

  public canRemoveLiquidity(shares: number) {
    const liquidity = this.getTotalLiquidity();
    return liquidity >= shares;
  }

  public getLiquidity() {
    return getComponentValue(
      this.liquidityModel,
      getEntityIdFromKeys([this.bankEntityId, this.player, this.resourceId]),
    );
  }

  public getMarket() {
    return getComponentValue(this.marketModel, getEntityIdFromKeys([this.bankEntityId, this.resourceId]));
  }

  public getSharesScaled = () => {
    const liquidity = this.getLiquidity();
    if (!liquidity) return 0;
    return Math.floor(Number(liquidity.shares) / 2 ** 64);
  };

  public getSharesUnscaled = () => {
    const liquidity = this.getLiquidity();
    if (!liquidity) return 0;
    return Number(liquidity.shares);
  };

  public getMyLP() {
    const [reserve_lords_amount, reserve_resource_amount] = this.getReserves();
    const liquidity = this.getTotalLiquidity();
    const shares = this.getSharesScaled();

    let lords_amount = 0;
    let resource_amount = 0;

    if (liquidity > 0) {
      lords_amount = (shares * reserve_lords_amount) / liquidity;
      resource_amount = (shares * reserve_resource_amount) / liquidity;
    }

    return [lords_amount, resource_amount];
  }

  public getMyFees(initial_lords_amount: number, initial_resource_amount: number) {
    const [current_lords_amount, current_resource_amount] = this.getMyLP();
    return [current_lords_amount - initial_lords_amount, current_resource_amount - initial_resource_amount];
  }

  public getTotalLiquidity() {
    const [lords_amount, resource_amount] = this.getReserves();
    return Math.floor(Math.sqrt(lords_amount * resource_amount));
  }

  public hasLiquidity() {
    return this.getSharesScaled() > 0;
  }

  public getReserves() {
    const market = this.getMarket();
    return [Number(market?.lords_amount || 0n), Number(market?.resource_amount || 0n)];
  }
}
