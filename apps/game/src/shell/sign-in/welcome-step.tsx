import { PrimaryLink } from "../live-chips";
import { HERO_ART } from "../mode-art";
import { portraitUrl } from "../identity-chip";
import type { ChosenProfile } from "./profile-step";

/**
 * The last screen of a first sign-in (design o3): the player's portrait and name over the hero painting, and Play back
 * to where they asked to sign in. The painting, not a castle, since a new player owns no realm yet.
 */
export const WelcomeStep = ({ profile, next }: { profile: ChosenProfile; next: string }) => (
  <div className="relative isolate -mx-4 flex flex-1 flex-col items-center justify-end gap-5 overflow-hidden px-5 pb-10 lg:mx-0 lg:min-h-[40rem] lg:rounded-2xl">
    <img src={HERO_ART} alt="" className="absolute inset-0 -z-10 size-full object-cover object-[50%_20%]" />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[#0c0a08]/30 to-[#0c0a08]" />
    <img
      src={portraitUrl(profile.portrait)}
      alt=""
      className="size-28 rounded-full border-4 border-[#f6ac1d] object-cover shadow-[0_0_24px_rgba(246,172,29,0.55)]"
    />
    <h1 className="frontier-hero text-center font-[Lexend] font-extrabold">You're in, {profile.name}</h1>
    <div className="w-full">
      <PrimaryLink to={next}>Play</PrimaryLink>
    </div>
  </div>
);
