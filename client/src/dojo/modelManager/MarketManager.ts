import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { LiquidityType, MarketType } from "./types";

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
    return Math.floor(Number(liquidity.shares.mag) / 2 ** 64);
  };

  public getMyLpPercentage = () => {
    const myShares = this.getSharesScaled();
    const totalShares = this.getTotalSharesScaled();
    if (totalShares === 0) return 0;
    return myShares / totalShares;
  };

  public getSharesUnscaled = () => {
    const liquidity = this.getLiquidity();
    if (!liquidity) return 0n;
    return liquidity.shares.mag;
  };

  public getMarketPrice = () => {
    const market = this.getMarket();
    if (!market) return 0;
    return Number(market.lords_amount) / Number(market.resource_amount);
  };

  public quoteResource = (lordsAmount: number) => {
    const [reserveLordsAmount, reserveResourceAmount] = this.getReserves();

    let resourceOptimal = (reserveResourceAmount * lordsAmount) / reserveLordsAmount;

    return resourceOptimal;
  };

  public quoteLords = (resourceAmount: number) => {
    const [reserveLordsAmount, reserveResourceAmount] = this.getReserves();

    let lordsOptimal = (reserveLordsAmount * resourceAmount) / reserveResourceAmount;

    return lordsOptimal;
  };

  public buyResource = (lordsAmount: number) => {
    const market = this.getMarket();
    if (!market) return 0;
    const cashInput = lordsAmount;
    const available = Number(market.resource_amount);
    const cash = Number(market.lords_amount);

    let k = cash * available;
    let newCash = cash + cashInput;
    let newResource = k / newCash;
    let resourcePayout = available - newResource;

    return Math.floor(resourcePayout);
  };

  public sellResource = (resourceAmount: number) => {
    const market = this.getMarket();
    if (!market) return 0;
    const quantity = resourceAmount;
    const available = Number(market.resource_amount);
    const cash = Number(market.lords_amount);
    let k = cash * available;
    let payout = cash - k / (available + quantity);
    return Math.floor(payout);
  };

  // price difference between swapping 1 resource and swapping N resources
  public slippage = (inputAmount: number, outputAmount: number, isSellingResource: boolean) => {
    const marketPrice = this.getMarketPrice();
    let executionPrice, slippagePercentage;

    if (isSellingResource) {
      executionPrice = outputAmount / inputAmount;
      slippagePercentage = ((executionPrice - marketPrice) / marketPrice) * 100;
    } else {
      executionPrice = inputAmount / outputAmount;
      slippagePercentage = ((executionPrice - marketPrice) / marketPrice) * 100;
    }

    return slippagePercentage;
  };

  public getMyLP() {
    const [reserveLordsAmount, reserveResourceAmount] = this.getReserves();
    const my_shares = this.getSharesUnscaled();
    const total_shares = this.getTotalSharesUnScaled();
    let lords_amount = Number((my_shares * BigInt(reserveLordsAmount)) / BigInt(total_shares));
    let resource_amount = Number((my_shares * BigInt(reserveResourceAmount)) / BigInt(total_shares));

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

  public getTotalLiquidityUnscaled() {
    const liquidity = this.getTotalLiquidity();
    return BigInt(liquidity * 2 ** 64);
  }

  public getTotalSharesUnScaled() {
    const market = this.getMarket();
    if (!market) return 0;
    return market.total_shares.mag;
  }

  public getTotalSharesScaled() {
    const market = this.getMarket();
    if (!market) return 0;
    return Math.floor(Number(market.total_shares.mag) / 2 ** 64);
  }

  public hasLiquidity() {
    return this.getSharesScaled() > 0;
  }

  public getReserves() {
    const market = this.getMarket();
    return [Number(market?.lords_amount || 0n), Number(market?.resource_amount || 0n)];
  }
}
