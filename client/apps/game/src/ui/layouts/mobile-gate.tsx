import { env } from "../../../env";

export const MobileGate = () => (
  <div className="flex h-screen w-screen flex-col items-center justify-center bg-brown p-4 text-center text-gold">
    <h1 className="mb-4 text-2xl font-bold">Mobile Version Not Available</h1>
    <p className="mb-6">
      This version of Blitz is not optimized for mobile devices. Please visit the desktop site or our
      mobile-friendly version.
    </p>

    <p className="mb-6">Please visit our mobile-friendly version at:</p>
    <a href={env.VITE_PUBLIC_MOBILE_VERSION_URL} className="text-xl font-bold text-gold underline hover:text-gold/80">
      Mobile Version
    </a>
  </div>
);
