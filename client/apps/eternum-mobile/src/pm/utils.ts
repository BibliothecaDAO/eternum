import BigNumber from "bignumber.js";
import { Uint256, uint256 } from "starknet";

export const shortAddress = (address: string) => {
  const addr = BigInt(address).toString(16);
  return "0x" + addr.substring(0, 4) + "..." + addr.substring(addr.length - 4, addr.length);
};

export const deepEqual = (a: unknown, b: unknown) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export const formatUnits = (value: string | number | bigint, decimals: number, precision = 2) => {
  const big = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(big)) return "0";
  const scaled = big / 10 ** decimals;
  return scaled.toFixed(precision);
};

export const formatCurrency = (value: string, _decimals: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

export const replaceAndFormat = (input?: string): string => {
  let template = input ?? "";
  if (!template) return "";

  template = template.replace(/\n/g, "<br>");
  const regex = /\{(.*?)\}/g;
  const toReplace = Array.from(template.matchAll(regex));

  for (const variable of toReplace) {
    if (variable[1].startsWith("DateTime:")) {
      const timestamp = variable[1].split(":")[1];
      const date = new Date(Number(timestamp) * 1_000);

      template = template.replace(
        variable[0],
        date.toLocaleString("default", { day: "2-digit", month: "long" }) +
          " " +
          date.toLocaleTimeString().substring(0, 5),
      );
    }

    if (variable[1].startsWith("Date:")) {
      const timestamp = variable[1].split(":")[1];
      const date = new Date(Number(timestamp) * 1_000);

      template = template.replace(variable[0], date.toLocaleString("default", { day: "2-digit", month: "long" }));
    }

    if (variable[1].startsWith("BigInt:")) {
      const decimals = Number(variable[1].split(":")[1]);
      const value = variable[1].split(":")[2];
      const parsed = formatUnits(value, decimals, 4);
      const formated = formatCurrency(parsed, decimals);

      template = template.replace(variable[0], formated);
    }
  }

  return template;
};

export function formatUint256(value: Uint256, decimals = 18, precision = 0) {
  return BigNumber(uint256.uint256ToBN(value).toString())
    .dividedBy(10 ** decimals)
    .toFixed(precision)
    .replace(/^(\d+)(?:\.0+|(\.\d*?)0+)$/, "$1$2");
}

export function parseUint256(value: string, decimals = 18) {
  return uint256.bnToUint256(
    BigInt(
      BigNumber(value)
        .multipliedBy(10 ** decimals)
        .toFixed(),
    ),
  );
}

export function parseUnits(value: string, decimals = 18) {
  return BigNumber(value)
    .multipliedBy(10 ** decimals)
    .toFixed(0);
}
