import { env } from "../../env";

interface TracingRuntimePolicyInput {
  configured: boolean;
  isProduction: boolean;
}

export function shouldEnableTracingRuntime(input: TracingRuntimePolicyInput): boolean {
  return input.configured && !input.isProduction;
}

export const TRACING_RUNTIME_ENABLED = shouldEnableTracingRuntime({
  configured: env.VITE_TRACING_ENABLED,
  isProduction: import.meta.env.PROD,
});
