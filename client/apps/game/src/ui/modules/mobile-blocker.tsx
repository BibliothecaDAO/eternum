interface MobileBlockerProps {
  mobileVersionUrl?: string;
}

export const MobileBlocker = ({ mobileVersionUrl }: MobileBlockerProps) => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-brown p-4 text-center text-gold">
      <h1 className="mb-4 text-2xl font-bold">Redirecting to Mobile</h1>
      <p className="mb-6">Taking you to the mobile experience now.</p>

      <p className="mb-6">If the redirect does not happen, open:</p>
      <a href={mobileVersionUrl} className="text-xl font-bold underline text-gold hover:text-gold/80">
        {mobileVersionUrl}
      </a>
    </div>
  );
};

export default MobileBlocker;
