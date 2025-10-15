import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { Button } from "@/ui/design-system/atoms";
import { Controller } from "@/ui/modules/controller/controller";
import { useNavigate } from "react-router-dom";

// Served from client/public/images/landing/wooden-panel.png
const LANDING_PANEL_IMAGE = "/borders/landing-frame-1.png";

export const LandingWelcome = () => {
  const navigate = useNavigate();

  return (
    <section className="flex w-full justify-center px-4 sm:px-6">
      <div className="relative w-full max-w-4xl">
        <img
          alt=""
          aria-hidden="true"
          src={LANDING_PANEL_IMAGE}
          loading="lazy"
          className="w-full select-none object-contain pointer-events-none"
        />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 py-10 text-center text-gold sm:px-10">
          <EternumWordsLogo className="mx-auto w-56 sm:w-48 lg:w-72 xl:w-[360px]" />

          <div className="mt-8 flex gap-4 items-center  ">
            <Button onClick={() => navigate("/play")}>Enter Blitz</Button>
            <div className="flex justify-end">
              <Controller />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
