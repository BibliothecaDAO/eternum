type ConsoleFieldValue = string | number | boolean | bigint | null | undefined;

const formatConsoleFieldValue = (value: Exclude<ConsoleFieldValue, undefined>): string => {
  if (typeof value === "string") {
    return JSON.stringify(value.replace(/\s+/g, " ").trim());
  }
  return String(value);
};

export const appendConsoleFields = (message: string, fields: Readonly<Record<string, ConsoleFieldValue>>): string => {
  const formattedFields = Object.entries(fields).flatMap(([name, value]) =>
    value === undefined ? [] : `${name}=${formatConsoleFieldValue(value)}`,
  );
  return formattedFields.length > 0 ? `${message} ${formattedFields.join(" ")}` : message;
};
