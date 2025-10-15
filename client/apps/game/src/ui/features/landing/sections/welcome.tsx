import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { Button } from "@/ui/design-system/atoms";
import { Controller } from "@/ui/modules/controller/controller";
import { useNavigate } from "react-router-dom";

// Served from client/public/images/landing/wooden-panel.png
const LANDING_PANEL_IMAGE = "/borders/landing-frame-1.png";

export const LandingWelcome = () => {
  const navigate = useNavigate();

  return (
    <section className="flex w-full justify-center px-3 sm:px-4 lg:px-6">
      <div className="relative w-full max-w-2xl sm:max-w-3xl 2xl:max-w-4xl">
        <img
          alt=""
          aria-hidden="true"
          src={LANDING_PANEL_IMAGE}
          loading="lazy"
          className="mx-auto w-full max-h-[60vh] max-w-[640px] select-none object-contain pointer-events-none md:max-h-[65vh] md:max-w-full 2xl:max-h-none"
        />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 py-8 text-center text-gold sm:px-8 sm:py-10">
          <EternumWordsLogo className="mx-auto w-44 sm:w-56 lg:w-72 xl:w-[360px]" />

          <div className="mt-6 flex w-full flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-4">
            <Button className="w-full sm:w-auto" onClick={() => navigate("/play")}>Enter Blitz</Button>
            <div className="flex justify-center sm:justify-end">
              <Controller />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
