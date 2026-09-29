import { useState, type FormEvent } from "react";

import { ArrowRight, Mail } from "@/ui/design-system/atoms/game-icons";
import { DiscordGlyph } from "@/ui/features/frontier/glyphs";

import { HERO_ART } from "../mode-art";

/**
 * The first screen of sign-in (design o3): the hero painting under the lore line, Discord, and a code by email. The
 * first sign-in by either creates the player's Realms account.
 */
export const StartStep = ({
  pending,
  error,
  onDiscord,
  onEmail,
}: {
  pending: boolean;
  error: string | null;
  onDiscord: () => void;
  onEmail: (email: string) => void;
}) => {
  const [email, setEmail] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onEmail(email.trim());
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative isolate -mx-4 flex min-h-[46dvh] flex-col justify-end overflow-hidden px-5 pb-6 lg:mx-0 lg:min-h-[22rem] lg:rounded-2xl">
        <img src={HERO_ART} alt="" className="absolute inset-0 -z-10 size-full object-cover object-[50%_20%]" />
        <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-[#0c0a08]" />
        <h1 className="frontier-hero font-[Lexend] !text-[30px] font-extrabold leading-[1.1]">
          <span className="block">The Mist forgets.</span>
          <span className="block">Your realm remembers.</span>
        </h1>
      </div>
      <div className="flex flex-col gap-5 pt-5">
        <button
          type="button"
          disabled={pending}
          onClick={onDiscord}
          className="flex h-[60px] items-center justify-center gap-3 rounded-[18px] border border-[#8f97ff] bg-[#5865f2] font-[Lexend] text-[22px] font-extrabold text-white shadow-[0_5px_0_#2f37a3] disabled:opacity-45"
        >
          <DiscordGlyph className="size-7" />
          Discord
        </button>
        <div className="flex items-center gap-3 text-[13px] text-[#6e6148]">
          <span className="h-px flex-1 bg-[#46351c]" />
          or
          <span className="h-px flex-1 bg-[#46351c]" />
        </div>
        <form onSubmit={submit} className="flex gap-3">
          <label className="flex h-[60px] min-w-0 flex-1 items-center gap-2 rounded-[18px] border border-[#46351c] bg-[#15100a] px-4 focus-within:border-[#f6ac1d]">
            <Mail className="size-6 shrink-0" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@mail.com"
              aria-label="Email"
              className="min-w-0 flex-1 bg-transparent text-[17px] text-[#eadfc8] outline-none placeholder:text-[#6e6148]"
            />
          </label>
          <button
            type="submit"
            aria-label="Email me a code"
            disabled={pending}
            className="frontier-primary flex w-[60px] shrink-0 items-center justify-center"
          >
            <ArrowRight className="size-7" />
          </button>
        </form>
        {error && <p className="text-center text-[15px] text-[#f08a6a]">{error}</p>}
      </div>
    </div>
  );
};
