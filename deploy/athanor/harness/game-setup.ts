import { HarnessProvider } from "./provider";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for private game setup`);
  return value;
};

/** Administration must bypass the public endpoint's play-only fee and tip policy. */
export function createHarnessAdminProvider(): HarnessProvider {
  return new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
}
