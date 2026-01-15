interface MobileBlockerProps {
  mobileVersionUrl?: string;
}

export const MobileBlocker = ({ mobileVersionUrl }: MobileBlockerProps) => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-brown p-4 text-center text-gold">
      <h1 className="mb-4 text-2xl font-bold">Mobile Version Not Available</h1>
      <p className="mb-6">
        This version of Blitz is not optimized for mobile devices. Please visit the desktop site or our mobile-friendly
        version.
      </p>

      <p className="mb-6">Please visit our mobile-friendly version at:</p>
      <a href={mobileVersionUrl} className="text-xl font-bold underline text-gold hover:text-gold/80">
        Mobile Version
      </a>
    </div>
  );
};

export default MobileBlocker;
