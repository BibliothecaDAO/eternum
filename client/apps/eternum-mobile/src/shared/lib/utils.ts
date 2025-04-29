import { divideByPrecision } from "@bibliothecadao/eternum";
import { getNeighborHexes, HexPosition } from "@bibliothecadao/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AppRoute } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to ensure type-safety when using routes
export const getRoute = (route: AppRoute): AppRoute => route;

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const formatNumber = (num: number, decimals: number = 0): string => {
  // Convert to string with max decimals
  let str = num.toFixed(decimals);

  // Remove trailing zeros after decimal point
  if (str.includes(".")) {
    str = str.replace(/\.?0+$/, "");
  }

  return str;
};

export const currencyFormat = (num: number, decimals: number = 0): string => {
  const formattedDecimals = formatNumber(divideByPrecision(num), decimals);
  return Number(formattedDecimals).toLocaleString();
};

export function currencyIntlFormat(num: number, decimals: number = 2): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: decimals,
  }).format(num || 0);
}

export const generateHexPositions = (center: HexPosition, radius: number) => {
  const positions: any[] = [];
  const positionSet = new Set(); // To track existing positions

  // Helper function to add position if not already added
  const addPosition = (col: number, row: number, isBorder: boolean) => {
    const key = `${col},${row}`;
    if (!positionSet.has(key)) {
      const position = {
        col,
        row,
        isBorder,
      };
      positions.push(position);
      positionSet.add(key);
    }
  };

  // Add center position
  addPosition(center.col, center.row, false);

  // Generate positions in expanding hexagonal layers
  let currentLayer = [center];
  for (let i = 0; i < radius; i++) {
    const nextLayer: any = [];
    currentLayer.forEach((pos) => {
      getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
        if (!positionSet.has(`${neighbor.col},${neighbor.row}`)) {
          addPosition(neighbor.col, neighbor.row, i === radius - 1);
          nextLayer.push({ col: neighbor.col, row: neighbor.row });
        }
      });
    });
    currentLayer = nextLayer; // Move to the next layer
  }

  return positions;
};
