
export function addSpacesBeforeCapitals(str: string): string {
  return str.replace(/([A-Z])/g, " $1").trim();
}

export function formatNumberWithSpaces(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const formatAmount = (amount: number) => {
  if (amount < 1) {
    return `${amount * ETERNUM_CONFIG().resources.resourcePrecision}`;
  } else if (amount < ETERNUM_CONFIG().resources.resourcePrecision) {
    return `${amount.toFixed(amount % 1 === 0 ? 0 : (amount % 1) % 0.1 === 0 ? 1 : 2)}K`;
  } else {
    return `${(amount / ETERNUM_CONFIG().resources.resourcePrecision).toFixed(amount % ETERNUM_CONFIG().resources.resourcePrecision === 0 ? 0 : (amount % ETERNUM_CONFIG().resources.resourcePrecision) % 10 === 0 ? 1 : 2)}M`;
  }
};

export const formatNumber = (num: number, decimals: number): string => {
  let str = num.toFixed(decimals);

  if (str.includes(".")) {
    str = str.replace(/\.?0+$/, "");
  }

  return str;
};

export function formatNumberWithCommas(number: number): string {
  return number.toLocaleString("en-US");
}

export const currencyFormat = (num: number, decimals: number): string => {
  return formatNumber(num / ETERNUM_CONFIG().resources.resourcePrecision, decimals);
};

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * ETERNUM_CONFIG().resources.resourcePrecision);
}

export function divideByPrecision(value: number): number {
  return value / ETERNUM_CONFIG().resources.resourcePrecision;
}
