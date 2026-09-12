/** Every operational line the runner prints is one JSON object with a snake_case event name. */
export const logEvent = (event: string, fields: Record<string, unknown>): void => {
  console.log(JSON.stringify({ event, ...fields }, bigintAsString));
};

const bigintAsString = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;
