export const STORAGE_INFINITY_THRESHOLD_KG = Number((2n ** 64n - 1n) / 1000n);

export type FormattedStorageValue = {
  display: string;
  isInfinite: boolean;
};

export type FormatStorageValueOptions = Intl.NumberFormatOptions & {
  locale?: string;
  threshold?: number;
  forceInfinite?: boolean;
  fallback?: string;
};

export const formatStorageValue = (
  value: number | null | undefined,
  options: FormatStorageValueOptions = {},
): FormattedStorageValue => {
  const {
    locale = "en-US",
    threshold = STORAGE_INFINITY_THRESHOLD_KG,
    forceInfinite,
    fallback = "0",
    ...intlOptions
  } = options;

  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  const shouldDisplayInfinite = forceInfinite ?? (numericValue !== null && numericValue >= threshold);

  if (shouldDisplayInfinite) {
    return { display: "∞", isInfinite: true };
  }

  if (numericValue === null) {
    return { display: fallback, isInfinite: false };
  }

  return {
    display: numericValue.toLocaleString(locale, { maximumFractionDigits: 0, ...intlOptions }),
    isInfinite: false,
  };
};

export const isStorageCapacityInfinite = (
  value: number | null | undefined,
  threshold: number = STORAGE_INFINITY_THRESHOLD_KG,
) => {
  return typeof value === "number" && Number.isFinite(value) && value >= threshold;
};
