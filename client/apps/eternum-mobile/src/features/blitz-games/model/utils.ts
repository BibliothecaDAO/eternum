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
      if (byte !== 0) out += String.fromCharCode(byte);
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
      if (value.startsWith("0x") || value.startsWith("0X")) {
        return Number(BigInt(value));
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const formatCountdown = (secondsLeft: number): string => {
  const total = Math.max(0, Math.floor(secondsLeft));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
};
