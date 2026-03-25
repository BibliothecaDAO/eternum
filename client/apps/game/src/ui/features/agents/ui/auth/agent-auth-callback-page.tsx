import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { completeMyAgentSetup } from "../../api/client";

export const AgentAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finalizing your agent setup...");

  useEffect(() => {
    const { hashParams, startappFromHash } = parseHashState(window.location.hash);
    const agentId = hashParams.get("agentId");
    const authSessionId = hashParams.get("authSessionId");
    const state = hashParams.get("state");
    const startapp = searchParams.get("startapp") ?? startappFromHash;

    if (!agentId || !authSessionId || !state || !startapp) {
      setMessage("This setup link is missing required auth parameters.");
      return;
    }

    void completeMyAgentSetup(agentId, {
      authSessionId,
      state,
      startapp,
    })
      .then((response) => {
        window.opener?.postMessage(
          {
            type: "agent-auth-complete",
            agentId: response.agentId,
          },
          window.location.origin,
        );
        setMessage("Agent setup complete. Returning to your dashboard...");
        setTimeout(() => {
          navigate("/?tab=agents", { replace: true });
        }, 750);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Agent setup could not be completed.");
      });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-gold">
      <div className="mx-auto max-w-xl rounded-3xl border border-gold/20 bg-black/55 p-8 backdrop-blur-xl">
        <h1 className="font-cinzel text-3xl text-gold">Agent Auth</h1>
        <p className="mt-4 text-sm text-gold/70">{message}</p>
      </div>
    </div>
  );
};

function parseHashState(hash: string): { hashParams: URLSearchParams; startappFromHash: string | null } {
  const rawHash = hash.replace(/^#/, "");
  const [hashQuery, hashStartapp] = rawHash.split("?startapp=");
  return {
    hashParams: new URLSearchParams(hashQuery),
    startappFromHash: hashStartapp ?? null,
  };
}
