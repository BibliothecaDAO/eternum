import { getComponentValue, HasValue, runQuery, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ResourcesIds, ClientComponents, ContractAddress, ID } from "@bibliothecadao/types";
import { configManager } from "./config-manager";

export class MarketManager {
  constructor(
    private readonly components: ClientComponents,
    private readonly _player: ContractAddress,
    private readonly _resourceId: ResourcesIds,
  ) { }

  get player() {
    return this._player;
  }

  get resourceId() {
    return this._resourceId;
  }

  public hasReserves() {
    const market = this.getMarket();
    return market && market.lords_amount > 0 && market.resource_amount > 0;
  }

  public canRemoveLiquidity(shares: number) {
    const liquidity = this.getTotalLiquidity();
    return liquidity >= shares;
  }

  public getPlayerLiquidity() {
    return getComponentValue(this.components.Liquidity, getEntityIdFromKeys([this.player, BigInt(this.resourceId)]));
  }

  public getMarket() {
    return getComponentValue(this.components.Market, getEntityIdFromKeys([BigInt(this.resourceId)]));
  }

  public getPlayerSharesScaled = () => {
    const liquidity = this.getPlayerLiquidity();
    if (!liquidity) return 0;
    return Math.floor(Number(liquidity.shares));
  };

  public getMyLpPercentage = () => {
    const myShares = this.getPlayerSharesScaled();
    const totalShares = this.getTotalSharesScaled();
    if (totalShares === 0) return 0;
    return myShares / totalShares;
  };

  public getSharesUnscaled = () => {
    const liquidity = this.getPlayerLiquidity();
    if (!liquidity) return 0n;
    return liquidity.shares;
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

  public getOutputAmount(inputAmount: number, inputReserve: bigint, outputReserve: bigint, feeRateNum: number) {
    // Ensure reserves are not zero and input amount is valid
    if (inputReserve <= 0n || outputReserve < 0n) {
      throw new Error("Reserves must be >= zero");
    }
    if (inputAmount < 0) {
      throw new Error("Input amount must be >= zero");
    }

    // Calculate the input amount after fee
    const feeRateDenom = configManager.getBankConfig().lpFeesDenominator;
    const inputAmountWithFee = BigInt(inputAmount) * BigInt(feeRateDenom - feeRateNum);

    // Calculate output amount based on the constant product formula with fee
    // (x + Δx) * (y - Δy) = k, where k = x * y
    // Solving for Δy and including the fee:
    // Δy = y - (x * y) / (x + Δx * (1 - fee))

    const numerator = BigInt(inputAmountWithFee) * BigInt(outputReserve);
    const denominator = BigInt(inputReserve) * BigInt(feeRateDenom) + inputAmountWithFee;

    // Subtract 1 to round down the result, ensuring the exchange rate is maintained
    return numerator / denominator;
  }

  public getInputPrice(inputAmount: number, inputReserve: bigint, outputReserve: bigint, feeRateNum: number) {
    // Ensure reserves are not zero and input amount is valid
    if (inputReserve < 0 || outputReserve < 0) {
      throw new Error("Reserves must be >= zero");
    }
    if (inputAmount < 0) {
      throw new Error("Input amount must be >= zero");
    }

    // Calculate the input amount after fee
    const feeRateDenom = configManager.getBankConfig().lpFeesDenominator;
    const inputAmountWithFee = BigInt(inputAmount) * BigInt(feeRateDenom - feeRateNum);

    // Calculate output amount based on the constant product formula with fee
    // (x + Δx) * (y - Δy) = k, where k = x * y
    // Solving for Δy:
    // Δy = (y * Δx) / (x + Δx)
    const numerator = BigInt(outputReserve) * inputAmountWithFee;
    const denominator = BigInt(inputReserve) * BigInt(feeRateDenom) + inputAmountWithFee;

    // Round down the result
    return numerator / denominator;
  }
  public calculateResourceOutputForLordsInput = (lordsAmount: number, feeRateNum: number) => {
    const market = this.getMarket();
    if (!market) return 0;

    let outputAmount = 0n;
    try {
      outputAmount = this.getOutputAmount(lordsAmount, market.lords_amount, market.resource_amount, feeRateNum);
    } catch (e) {
      console.log(e);
    }
    return Number(outputAmount);
  };

  public calculateLordsInputForResourceOutput = (resourceAmount: number, feeRateNum: number) => {
    const market = this.getMarket();
    if (!market) return 0;

    // Calculate the input amount of Lords needed to buy the desired amount of resource
    const feeRateDenom = configManager.getBankConfig().lpFeesDenominator;
    const inputReserve = market.lords_amount;
    const outputReserve = market.resource_amount;

    // Using the inverse of the constant product formula:
    // x' = x * y / (y - Δy) - x
    // Where x is input reserve (Lords), y is output reserve (Resource),
    // Δy is the desired output amount, and x' is the required input amount

    const numerator = BigInt(inputReserve) * BigInt(outputReserve);
    const denominator = BigInt(outputReserve) - BigInt(resourceAmount);
    if (denominator <= 0n) return 0;

    const inputAmount = numerator / denominator - BigInt(inputReserve);

    // Adjust for fees
    const inputAmountWithFee = (inputAmount * BigInt(feeRateDenom)) / BigInt(feeRateDenom - feeRateNum);

    return Number(inputAmountWithFee);
  };

  public calculateLordsOutputForResourceInput = (resourceAmount: number, feeRateNum: number) => {
    const market = this.getMarket();
    if (!market) return 0;

    let inputPrice = this.getInputPrice(resourceAmount, market.resource_amount, market.lords_amount, feeRateNum);
    return Number(inputPrice);
  };

  public calculateResourceInputForLordsOutput = (lordsAmount: number, feeRateNum: number) => {
    const market = this.getMarket();
    if (!market) return 0;

    // Calculate the input amount of Resource needed to get the desired amount of Lords
    const feeRateDenom = configManager.getBankConfig().lpFeesDenominator;
    const inputReserve = market.resource_amount;
    const outputReserve = market.lords_amount;

    // Using the inverse of the constant product formula:
    // x' = x * y / (y - Δy) - x
    // Where x is input reserve (Resource), y is output reserve (Lords),
    // Δy is the desired output amount, and x' is the required input amount

    const numerator = BigInt(inputReserve) * BigInt(outputReserve);
    const denominator = BigInt(outputReserve) - BigInt(lordsAmount);
    const inputAmount = numerator / denominator - BigInt(inputReserve);

    // Adjust for fees
    const inputAmountWithFee = (inputAmount * BigInt(feeRateDenom)) / BigInt(feeRateDenom - feeRateNum);

    return Number(inputAmountWithFee);
  };

  public slippage = (inputAmount: number, isBuyResource: boolean) => {
    const marketPrice = this.getMarketPrice();

    const outputAmount = isBuyResource
      ? this.calculateResourceOutputForLordsInput(inputAmount, 0)
      : this.calculateLordsOutputForResourceInput(inputAmount, 0);

    const marketPriceAmount = isBuyResource ? inputAmount / marketPrice : inputAmount * marketPrice;

    // Calculate the slippage percentage
    const slippagePercentage = ((marketPriceAmount - outputAmount) / marketPriceAmount) * 100;

    return slippagePercentage;
  };

  public getMyLP() {
    const [reserveLordsAmount, reserveResourceAmount] = this.getReserves();
    const my_shares = this.getSharesUnscaled();
    const total_shares = this.getTotalSharesUnScaled();
    if (total_shares == 0) return [0, 0];
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
    return BigInt(liquidity);
  }

  public getTotalSharesUnScaled() {
    const market = this.getMarket();
    if (!market) return 0;
    return market.total_shares;
  }

  public getTotalSharesScaled() {
    const market = this.getMarket();
    if (!market) return 0;
    return Math.floor(Number(market.total_shares));
  }

  public playerHasLiquidity() {
    return this.getPlayerSharesScaled() > 0;
  }

  public getReserves() {
    const market = this.getMarket();
    return [Number(market?.lords_amount || 0n), Number(market?.resource_amount || 0n)];
  }

  public getLatestLiquidityEvent(playerStructureIds: ID[]) {
    let mostRecentEvent: ComponentValue<ClientComponents["events"]["LiquidityEvent"]["schema"]> | null = null;

    playerStructureIds.forEach((structureId) => {
      const liquidityEvents = runQuery([
        HasValue(this.components.events.LiquidityEvent, {
          entity_id: structureId,
          resource_type: this.resourceId,
        }),
      ]);

      liquidityEvents.forEach((event) => {
        const eventInfo = getComponentValue(this.components.events.LiquidityEvent, event);
        if (eventInfo && (!mostRecentEvent || eventInfo.timestamp > mostRecentEvent.timestamp)) {
          mostRecentEvent = eventInfo;
        }
      });
    });

    return mostRecentEvent as ComponentValue<ClientComponents["events"]["LiquidityEvent"]["schema"]> | null;
  }
}
