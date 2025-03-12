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
