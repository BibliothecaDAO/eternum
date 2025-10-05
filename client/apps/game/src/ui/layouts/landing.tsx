import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms";
import { Controller } from "../modules/controller/controller";
interface LandingLayoutProps {
  backgroundImage: string;
}

export const LandingLayout = ({ backgroundImage }: LandingLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-gold">
      <div className="absolute inset-0">
        <img
          alt="Eternum background"
          src={`/images/covers/blitz/${backgroundImage}.png`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex justify-end px-6 py-6 lg:px-10">
          <Controller />
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center lg:px-0">
          <div className="w-full rounded-3xl border border-white/10 bg-black/50 p-10 backdrop-blur">
            <EternumWordsLogo className="mx-auto w-56 sm:w-48 lg:w-72 xl:w-[360px]" />

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="text-sm text-white/70">
                Access your Cartridge profile or jump right in.
              </div>
              <Button onClick={() => navigate("/play")}>Enter Eternum</Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
