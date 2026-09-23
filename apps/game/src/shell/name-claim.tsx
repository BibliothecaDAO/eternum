import { useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";

import { GoldButton } from "./kit";

const NAME_RULES = "3–20 characters · unique across the realms · shown everywhere";

/** Claims or changes the display name; a new player starts from the name suggested at their first sign-in. */
export const NameClaim = ({
  currentName,
  suggestion = null,
  onDone,
}: {
  currentName: string | null;
  suggestion?: string | null;
  onDone: () => void;
}) => {
  const [name, setName] = useState(currentName ?? suggestion ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claim = async () => {
    setPending(true);
    setError(null);
    try {
      await identityClient.updateUser({ name: name.trim() });
      onDone();
    } catch (cause) {
      setError(nameRefusal(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void claim();
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Choose your name"
          maxLength={20}
          className="w-56 rounded-lg border border-gold/30 bg-black/40 px-3 py-2.5 text-[14px] text-gold outline-none placeholder:text-gold/40 focus:border-gold"
        />
        <GoldButton type="submit" disabled={pending || name.trim().length < 3}>
          {pending ? "Saving…" : currentName ? "Change name" : "Claim name"}
        </GoldButton>
      </div>
      <div className="mt-1.5 text-[11.5px] text-gold/50">{NAME_RULES}</div>
      {error ? <div className="mt-2 text-[12.5px] text-danger">{error}</div> : null}
    </form>
  );
};

/** The server names why a name was refused (NAME_TAKEN, NAME_INVALID:<rule>); the player reads one sentence. */
const nameRefusal = (cause: unknown): string => {
  const reason = cause instanceof Error ? cause.message : "";
  if (reason === "NAME_TAKEN") return "That name is taken. Try another.";
  if (reason.startsWith("NAME_INVALID:")) return `Names use ${reason.slice("NAME_INVALID:".length)}.`;
  console.error("identity_name_claim_failed", { error: reason });
  return "The name was not saved. Try again in a moment.";
};
