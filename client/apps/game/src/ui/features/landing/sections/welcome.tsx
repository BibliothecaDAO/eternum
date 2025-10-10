import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { Button } from "@/ui/design-system/atoms";
import { Controller } from "@/ui/modules/controller/controller";
import { useNavigate } from "react-router-dom";

export const LandingWelcome = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-white/10 bg-black/50 p-10 text-center text-gold backdrop-blur">
      <EternumWordsLogo className="mx-auto w-56 sm:w-48 lg:w-72 xl:w-[360px]" />

      <div className="mt-8 flex flex-col items-center gap-4 text-white/80">
        <p className="text-sm text-white/70">Access your Cartridge profile or jump right in.</p>
        <Button onClick={() => navigate("/play")}>Enter Blitz</Button>
        <div className="flex justify-end">
          <Controller />
        </div>
      </div>
    </section>
  );
};
