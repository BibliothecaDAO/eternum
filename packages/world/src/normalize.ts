export const strip0x = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);

export const toLowerHex = (value: string) => `0x${strip0x(value).toLowerCase()}`;

export const leftPadHex = (hexWithout0x: string, width: number) => hexWithout0x.padStart(width, "0");

export const normalizeHex = (value: string) => {
  const body = strip0x(value).toLowerCase();
  const padded = leftPadHex(body, 64);
  return `0x${padded}`;
};

export const normalizeSelector = (value: string) => normalizeHex(value);

export const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  const padded = leftPadHex(hex, 64);
  return `0x${padded}`;
};
