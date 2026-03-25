import type { AgentSessionResolver, LoadAgentSessionInput, ResolvedAgentSession } from "./types";

export async function loadAgentSession<
  TContext = Record<string, unknown>,
  TSession extends ResolvedAgentSession = ResolvedAgentSession,
>(
  input: LoadAgentSessionInput<TContext> & {
    resolver: AgentSessionResolver<TContext, TSession>;
  },
): Promise<TSession> {
  return input.resolver.load(input);
}
