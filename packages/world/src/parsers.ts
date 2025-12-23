export const decodePaddedFeltAscii = (hex: string): string => {
  try {
    if (!hex) return "";
    const value = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (!value || value === "0") return "";

    let cursor = 0;
    while (cursor + 1 < value.length && value.slice(cursor, cursor + 2) === "00") {
      cursor += 2;
    }

    let out = "";
    for (; cursor + 1 < value.length; cursor += 2) {
      const byte = parseInt(value.slice(cursor, cursor + 2), 16);
      if (Number.isNaN(byte) || byte === 0) continue;
      out += String.fromCharCode(byte);
    }

    return out;
  } catch {
    return "";
  }
};

export const parseMaybeHexToNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    try {
      if (value.startsWith("0x") || value.startsWith("0X")) return Number(BigInt(value));
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const parseMaybeBool = (value: unknown): boolean | null => {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  const numeric = parseMaybeHexToNumber(value);
  if (numeric == null) return null;
  return numeric !== 0;
};
