import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms";
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

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center lg:px-0">
        <div className="rounded-3xl border border-white/10 bg-black/50 p-10 backdrop-blur">
          <EternumWordsLogo className="w-56 sm:w-48 lg:w-72 xl:w-[360px]" />

          <div className="mt-8 flex flex-col items-center gap-4">
            <Button onClick={() => navigate("/play")}>Enter Eternum</Button>
          </div>
        </div>
      </main>
    </div>
  );
};
